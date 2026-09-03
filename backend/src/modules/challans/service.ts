import { Prisma, ChallanStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';

// Helper to generate the next CHL-XXXXX number
const generateChallanNumber = async (tx: Prisma.TransactionClient): Promise<string> => {
  const counter = await tx.counter.upsert({
    where: { key: 'challan_seq' },
    update: { value: { increment: 1 } },
    create: { key: 'challan_seq', value: 1 },
  });

  const currentYear = new Date().getFullYear();
  const sequence = String(counter.value).padStart(4, '0');
  return `CHL-${currentYear}-${sequence}`;
};

export const getChallans = async (params: {
  page?: number;
  limit?: number;
  status?: ChallanStatus;
  q?: string;
}) => {
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 50;
  const skip = (page - 1) * limit;

  const where: Prisma.ChallanWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.q) {
    where.OR = [
      { challanNumber: { contains: params.q, mode: 'insensitive' } },
      // To search within JSON we can use string cast or a raw query. Prisma supports path querying on JSON for postgres:
      {
        customerSnapshot: {
          path: ['name'],
          string_contains: params.q,
        },
      },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.challan.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.challan.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getChallanById = async (id: string) => {
  const challan = await prisma.challan.findUnique({
    where: { id },
    include: {
      items: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!challan) {
    throw new AppError(404, 'NOT_FOUND', 'Challan not found');
  }

  return challan;
};

export const createChallan = async (
  customerId: string,
  itemsPayload: { productId: string; quantity: number; unitPrice?: number }[],
  userId: string,
  notes?: string,
  requestedStatus: ChallanStatus = ChallanStatus.DRAFT,
) => {
  return prisma.$transaction(
    async (tx) => {
      // 1. Fetch customer to snapshot
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer || customer.deletedAt) {
        throw new AppError(404, 'NOT_FOUND', 'Customer not found or deleted');
      }

      const customerSnapshot = {
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        businessName: customer.businessName,
        gstNumber: customer.gstNumber,
        address: customer.address,
      };

      // 2. Fetch products to snapshot and calculate totals
      const productIds = itemsPayload.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, deletedAt: null, isActive: true },
      });

      if (products.length !== productIds.length) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          'One or more products are invalid, inactive, or deleted',
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      let totalAmount = new Prisma.Decimal(0);
      let totalQuantity = 0;

      const challanItemsData = itemsPayload.map((item) => {
        const product = productMap.get(item.productId)!;
        const finalUnitPrice =
          item.unitPrice !== undefined ? new Prisma.Decimal(item.unitPrice) : product.unitPrice;
        const lineTotal = finalUnitPrice.mul(item.quantity);

        totalAmount = totalAmount.add(lineTotal);
        totalQuantity += item.quantity;

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.category,
          unitPrice: finalUnitPrice,
          quantity: item.quantity,
          lineTotal,
        };
      });

      // 3. Generate Challan Number
      const challanNumber = await generateChallanNumber(tx);

      // 4. Create Challan in DRAFT mode first
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          customerId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customerSnapshot: customerSnapshot as any,
          status: ChallanStatus.DRAFT,
          totalQuantity,
          totalAmount,
          notes,
          createdById: userId,
          items: {
            create: challanItemsData,
          },
        },
        include: { items: true },
      });

      // 5. If requested status is CONFIRMED, perform confirmation logic
      if (requestedStatus === ChallanStatus.CONFIRMED) {
        return await internalConfirmChallan(tx, challan.id, userId);
      }

      return challan;
    },
    { timeout: 20000, maxWait: 15000 },
  );
};

export const updateChallan = async (
  id: string,
  itemsPayload?: { productId: string; quantity: number; unitPrice?: number }[],
  notes?: string,
) => {
  return prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!challan) throw new AppError(404, 'NOT_FOUND', 'Challan not found');
    if (challan.status !== ChallanStatus.DRAFT) {
      throw new AppError(400, 'BAD_REQUEST', 'Only DRAFT challans can be edited');
    }

    const updateData: Prisma.ChallanUpdateInput = {};
    if (notes !== undefined) updateData.notes = notes;

    if (itemsPayload) {
      // Re-calculate snapshot for items
      const productIds = itemsPayload.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, deletedAt: null, isActive: true },
      });

      if (products.length !== productIds.length) {
        throw new AppError(400, 'BAD_REQUEST', 'One or more products are invalid');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      let totalAmount = new Prisma.Decimal(0);
      let totalQuantity = 0;

      const challanItemsData = itemsPayload.map((item) => {
        const product = productMap.get(item.productId)!;
        const finalUnitPrice =
          item.unitPrice !== undefined ? new Prisma.Decimal(item.unitPrice) : product.unitPrice;
        const lineTotal = finalUnitPrice.mul(item.quantity);
        totalAmount = totalAmount.add(lineTotal);
        totalQuantity += item.quantity;

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.category,
          unitPrice: finalUnitPrice,
          quantity: item.quantity,
          lineTotal,
        };
      });

      updateData.totalQuantity = totalQuantity;
      updateData.totalAmount = totalAmount;

      // Delete old items and create new ones
      await tx.challanItem.deleteMany({ where: { challanId: id } });

      updateData.items = {
        create: challanItemsData,
      };
    }

    return tx.challan.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });
  });
};

const internalConfirmChallan = async (tx: Prisma.TransactionClient, id: string, userId: string) => {
  const challan = await tx.challan.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!challan) throw new AppError(404, 'NOT_FOUND', 'Challan not found');
  if (challan.status !== ChallanStatus.DRAFT) {
    throw new AppError(400, 'BAD_REQUEST', 'Only DRAFT challans can be confirmed');
  }

  // Check stock and deduct
  for (const item of challan.items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product || product.deletedAt || !product.isActive) {
      throw new AppError(400, 'BAD_REQUEST', `Product ${item.productName} is invalid`);
    }

    if (product.currentStock < item.quantity) {
      throw new AppError(
        409,
        'CONFLICT',
        `Insufficient stock for ${item.productName}. Required: ${item.quantity}, Available: ${product.currentStock}`,
      );
    }

    const balanceAfter = product.currentStock - item.quantity;

    await tx.product.update({
      where: { id: product.id },
      data: { currentStock: balanceAfter },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity: item.quantity,
        type: 'OUT',
        reason: `Challan Confirmed: ${challan.challanNumber}`,
        referenceType: 'CHALLAN',
        referenceId: challan.id,
        balanceAfter,
        createdById: userId,
      },
    });
  }

  return tx.challan.update({
    where: { id },
    data: {
      status: ChallanStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
    include: { items: true },
  });
};

export const confirmChallan = async (id: string, userId: string) => {
  return prisma.$transaction((tx) => internalConfirmChallan(tx, id, userId), {
    timeout: 20000,
    maxWait: 15000,
  });
};

export const cancelChallan = async (id: string, userId: string) => {
  return prisma.$transaction(
    async (tx) => {
      const challan = await tx.challan.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!challan) throw new AppError(404, 'NOT_FOUND', 'Challan not found');
      if (challan.status === ChallanStatus.CANCELLED) {
        throw new AppError(400, 'BAD_REQUEST', 'Challan is already cancelled');
      }

      if (challan.status === ChallanStatus.CONFIRMED) {
        // Restore stock
        for (const item of challan.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const balanceAfter = product.currentStock + item.quantity;

            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: balanceAfter },
            });

            await tx.stockMovement.create({
              data: {
                productId: product.id,
                quantity: item.quantity,
                type: 'IN',
                reason: `Challan Cancelled: ${challan.challanNumber}`,
                referenceType: 'CHALLAN_CANCEL',
                referenceId: challan.id,
                balanceAfter,
                createdById: userId,
              },
            });
          }
        }
      }

      return tx.challan.update({
        where: { id },
        data: {
          status: ChallanStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: { items: true },
      });
    },
    { timeout: 20000, maxWait: 15000 },
  );
};

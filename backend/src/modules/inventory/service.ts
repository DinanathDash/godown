import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { Prisma } from '@prisma/client';

export const getInventory = async (filters: {
  locationId?: string;
  itemId?: string;
  categoryId?: string;
  search?: string;
  availability?: 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK';
  page: number;
  limit: number;
}) => {
  const { locationId, itemId, categoryId, search, availability, page, limit } = filters;

  // available = physicalQty - reservedQty, so filtering on availability is a
  // column-to-column comparison. Prisma field references express that natively;
  // no raw SQL needed for a read.
  const availabilityFilter: Prisma.InventoryItemWhereInput =
    availability === 'IN_STOCK'
      ? { physicalQty: { gt: prisma.inventoryItem.fields.reservedQty } }
      : availability === 'OUT_OF_STOCK'
        ? { physicalQty: { lte: prisma.inventoryItem.fields.reservedQty } }
        : {};

  const where: Prisma.InventoryItemWhereInput = {
    ...(locationId && { locationId }),
    ...(itemId && { itemId }),
    ...(categoryId && { item: { categoryId } }),
    ...(search && {
      item: {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
        ...(categoryId ? { categoryId } : {}),
      },
    }),
    ...availabilityFilter,
  };

  const [total, data] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        item: { select: { id: true, name: true, sku: true, uom: true } },
        location: { select: { id: true, code: true, name: true } },
        batch: { select: { id: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return {
    data: data.map((d) => ({
      ...d,
      availableQty: d.physicalQty - d.reservedQty,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const adjustStock = async (
  userId: string,
  data: { inventoryItemId: string; type: 'IN' | 'OUT'; quantity: number; reason: string },
) => {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: data.inventoryItemId },
    });

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
    }

    if (data.type === 'OUT') {
      const available = item.physicalQty - item.reservedQty;
      if (available < data.quantity) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          `Insufficient available stock. Have ${available}, tried to deduct ${data.quantity}`,
        );
      }
    }

    const updated = await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        physicalQty:
          data.type === 'IN' ? { increment: data.quantity } : { decrement: data.quantity },
      },
    });

    // Create the ledger entry
    await tx.stockMovement.create({
      data: {
        inventoryItemId: item.id,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        balanceAfter: updated.physicalQty,
        referenceType: 'MANUAL',
        createdById: userId,
      },
    });

    return updated;
  });
};

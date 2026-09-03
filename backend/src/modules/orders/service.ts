import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';

export async function getOrders(query: { page: number; limit: number }) {
  const { page, limit } = query;

  const [total, data] = await Promise.all([
    prisma.customerOrder.count(),
    prisma.customerOrder.findMany({
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            item: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createOrder(data: {
  customerId: string;
  locationId: string;
  createdById: string;
  lines: { itemId: string; quantity: number }[];
}) {
  return prisma.$transaction(
    async (tx) => {
      const code = `ORD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      return tx.customerOrder.create({
        data: {
          code,
          customerId: data.customerId,
          locationId: data.locationId,
          createdById: data.createdById,
          status: 'DRAFT',
          lines: {
            create: data.lines.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );
}

export async function reserveOrder(orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.customerOrder.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });

      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
      if (order.status !== 'DRAFT') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Only DRAFT orders can be reserved');
      }

      // Attempt to reserve stock for every line. If one fails, the entire transaction rolls back automatically
      // because an AppError will be thrown.
      for (const line of order.lines) {
        const rows = await tx.$queryRaw<{ id: string; available: number }[]>`
        SELECT i.id, i."physicalQty" - i."reservedQty" AS available
        FROM inventory_items i
        JOIN batches b ON b.id = i."batchId"
        WHERE i."itemId" = ${line.itemId}
          AND i."locationId" = ${order.locationId}
          AND i."physicalQty" - i."reservedQty" > 0
        ORDER BY b."expiryDate" ASC NULLS LAST, i.id ASC
        FOR UPDATE OF i
      `;

        const totalAvailable = rows.reduce((sum, r) => sum + Number(r.available), 0);
        if (totalAvailable < line.quantity) {
          throw new AppError(
            409,
            'INSUFFICIENT_AVAILABLE',
            `Insufficient available stock for item ${line.itemId}`,
            [
              {
                itemId: line.itemId,
                requested: line.quantity,
                available: totalAvailable,
              },
            ],
          );
        }

        // Allocate across batches, oldest first.
        let remaining = line.quantity;
        for (const row of rows) {
          if (remaining === 0) break;
          const take = Math.min(remaining, Number(row.available));

          await tx.inventoryItem.update({
            where: { id: row.id },
            data: { reservedQty: { increment: take } },
          });

          await tx.stockReservation.create({
            data: {
              orderLineId: line.id,
              inventoryItemId: row.id,
              quantity: take,
            },
          });

          remaining -= take;
        }
      }

      // Update the order status to RESERVED
      return tx.customerOrder.update({
        where: { id: orderId },
        data: { status: 'RESERVED', reservedAt: new Date() },
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );
}

export async function cancelOrder(orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.customerOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
      if (order.status === 'CANCELLED') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Order is already cancelled');
      }

      // If order was reserved, we must release the reservations
      if (order.status === 'RESERVED') {
        const reservations = await tx.stockReservation.findMany({
          where: { orderLine: { orderId }, releasedAt: null },
        });

        for (const r of reservations) {
          await tx.inventoryItem.update({
            where: { id: r.inventoryItemId },
            data: { reservedQty: { decrement: r.quantity } },
          });
          await tx.stockReservation.update({
            where: { id: r.id },
            data: { releasedAt: new Date() },
          });
        }
      }

      return tx.customerOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );
}

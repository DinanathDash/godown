import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { Prisma } from '@prisma/client';

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

/**
 * Holds stock against an order without moving it.
 *
 * Every statement here is a round trip to a remote Postgres, and the earlier
 * shape made one per batch per line: a three-line order spent ~7 seconds
 * inside the transaction, which read to the user as "nothing happened". The
 * work is the same, but it is now planned in memory and written in two
 * statements, so the whole thing is a handful of round trips.
 */
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

      const itemIds = [...new Set(order.lines.map((l) => l.itemId))];

      // One locking read covering every item on the order. Taking all the locks
      // in a single statement with a deterministic ORDER BY also gives every
      // concurrent reservation the same lock order, so two orders competing for
      // the same batches queue up instead of deadlocking.
      const rows =
        itemIds.length === 0
          ? []
          : await tx.$queryRaw<{ id: string; itemId: string; available: number }[]>`
        SELECT i.id, i."itemId", i."physicalQty" - i."reservedQty" AS available
        FROM inventory_items i
        JOIN batches b ON b.id = i."batchId"
        WHERE i."itemId" IN (${Prisma.join(itemIds)})
          AND i."locationId" = ${order.locationId}
          AND i."physicalQty" - i."reservedQty" > 0
        ORDER BY b."expiryDate" ASC NULLS LAST, i.id ASC
        FOR UPDATE OF i
      `;

      const byItem = new Map<string, { id: string; available: number }[]>();
      for (const row of rows) {
        const list = byItem.get(row.itemId) ?? [];
        list.push({ id: row.id, available: Number(row.available) });
        byItem.set(row.itemId, list);
      }

      // Plan the whole allocation before writing anything, oldest batch first.
      const allocations: {
        orderLineId: string;
        inventoryItemId: string;
        quantity: number;
      }[] = [];

      for (const line of order.lines) {
        const candidates = byItem.get(line.itemId) ?? [];
        const totalAvailable = candidates.reduce((sum, c) => sum + c.available, 0);

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

        let remaining = line.quantity;
        for (const candidate of candidates) {
          if (remaining === 0) break;
          const take = Math.min(remaining, candidate.available);
          if (take === 0) continue;

          // Spend it in memory too: two lines for the same item must not both
          // be allowed to claim the same units.
          candidate.available -= take;
          allocations.push({
            orderLineId: line.id,
            inventoryItemId: candidate.id,
            quantity: take,
          });
          remaining -= take;
        }
      }

      if (allocations.length > 0) {
        const increments = new Map<string, number>();
        for (const a of allocations) {
          increments.set(a.inventoryItemId, (increments.get(a.inventoryItemId) ?? 0) + a.quantity);
        }

        // Every increment in one statement, rather than an UPDATE per batch.
        await tx.$executeRaw`
          UPDATE inventory_items i
          SET "reservedQty" = i."reservedQty" + v.qty
          FROM (VALUES ${Prisma.join(
            [...increments].map(([id, qty]) => Prisma.sql`(${id}::text, ${qty}::int)`),
          )}) AS v(id, qty)
          WHERE i.id = v.id
        `;

        await tx.stockReservation.createMany({ data: allocations });
      }

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

 import { PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/AppError';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Reserves stock for a specific order line.
 * Uses a row-level lock (SELECT ... FOR UPDATE) to guarantee consistency under high concurrency.
 */
export const reserveStock = async (
  tx: TransactionClient,
  orderLineId: string,
  itemId: string,
  locationId: string,
  qtyRequired: number,
  userId: string
) => {
  if (qtyRequired <= 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Quantity to reserve must be greater than 0');
  }

  // 1. Lock the inventory rows for this item and location that have available stock
  // We order by updatedAt ASC to simulate a loose FIFO (oldest stock first)
  const availableInventoryRows = await tx.$queryRaw<{ id: string; physicalQty: number; reservedQty: number }[]>`
    SELECT id, "physicalQty", "reservedQty"
    FROM "InventoryItem"
    WHERE "itemId" = ${itemId}::uuid
      AND "locationId" = ${locationId}::uuid
      AND ("physicalQty" - "reservedQty") > 0
    ORDER BY "updatedAt" ASC
    FOR UPDATE
  `;

  let remainingToReserve = qtyRequired;
  const reservationsToCreate = [];

  for (const row of availableInventoryRows) {
    if (remainingToReserve <= 0) break;

    const available = row.physicalQty - row.reservedQty;
    const amountToReserve = Math.min(available, remainingToReserve);

    // Prepare reservation record
    reservationsToCreate.push({
      inventoryItemId: row.id,
      orderLineId,
      quantity: amountToReserve,
      createdById: userId,
    });

    // Update inventory item's reservedQty
    await tx.inventoryItem.update({
      where: { id: row.id },
      data: {
        reservedQty: {
          increment: amountToReserve,
        },
      },
    });

    remainingToReserve -= amountToReserve;
  }

  if (remainingToReserve > 0) {
    throw new AppError(400, 'BAD_REQUEST', `Insufficient available stock to reserve. Shortfall: ${remainingToReserve}`);
  }

  // Bulk create the reservations
  if (reservationsToCreate.length > 0) {
    await tx.stockReservation.createMany({
      data: reservationsToCreate,
    });
  }
};

/**
 * Releases stock reserved for a specific order line.
 * Automatically decrements the reservedQty on the respective InventoryItem.
 */
export const releaseReservation = async (
  tx: TransactionClient,
  orderLineId: string
) => {
  // Find the reservations to release
  const reservations = await tx.stockReservation.findMany({
    where: { orderLineId },
  });

  if (reservations.length === 0) return; // Nothing to release

  // We could lock here too, but since we are just decrementing, atomic operations (decrement) are sufficient.
  for (const reservation of reservations) {
    await tx.inventoryItem.update({
      where: { id: reservation.inventoryItemId },
      data: {
        reservedQty: {
          decrement: reservation.quantity,
        },
      },
    });
  }

  // Delete the reservations
  await tx.stockReservation.deleteMany({
    where: { orderLineId },
  });
};

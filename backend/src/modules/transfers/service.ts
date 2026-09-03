import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { Prisma, TransferStatus } from '@prisma/client';

/**
 * Prisma's 5s default is not enough for these transactions: each one makes
 * several sequential round trips to a remote Postgres, and a stock transfer
 * must not half-commit because the clock ran out.
 */
const TX_OPTIONS = { timeout: 20000, maxWait: 15000 } as const;

export async function getTransfers(query: {
  page: number;
  limit: number;
  status?: TransferStatus;
  sourceLocationId?: string;
  destinationLocationId?: string;
}) {
  const { page, limit, status, sourceLocationId, destinationLocationId } = query;
  const where: Prisma.StockTransferWhereInput = {
    ...(status && { status }),
    ...(sourceLocationId && { sourceLocationId }),
    ...(destinationLocationId && { destinationLocationId }),
  };

  const [total, data] = await Promise.all([
    prisma.stockTransfer.count({ where }),
    prisma.stockTransfer.findMany({
      where,
      include: {
        item: true,
        batch: true,
        source: true,
        destination: true,
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

export async function createTransfer(
  userId: string,
  data: {
    itemId: string;
    batchId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
  },
) {
  if (data.sourceLocationId === data.destinationLocationId) {
    throw new AppError(
      400,
      'INVALID_TRANSFER',
      'Source and destination locations cannot be the same',
    );
  }

  return prisma.$transaction(async (tx) => {
    // Reject an impossible transfer at request time, so the user finds out now
    // rather than when someone tries to dispatch it. This is a courtesy check,
    // not the guard: stock can change between request and dispatch, so the
    // authoritative check stays the conditional UPDATE in dispatchTransfer.
    const source = await tx.inventoryItem.findUnique({
      where: {
        itemId_locationId_batchId: {
          itemId: data.itemId,
          locationId: data.sourceLocationId,
          batchId: data.batchId,
        },
      },
    });

    if (!source) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'That item and batch is not stocked at the source godown',
      );
    }

    const available = source.physicalQty - source.reservedQty;
    if (available < data.quantity) {
      throw new AppError(
        409,
        'INSUFFICIENT_AVAILABLE',
        `Only ${available} available at the source godown, ${data.quantity} requested`,
        [
          {
            itemId: data.itemId,
            locationId: data.sourceLocationId,
            requested: data.quantity,
            available,
          },
        ],
      );
    }

    const code = `TRF-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return tx.stockTransfer.create({
      data: {
        code,
        itemId: data.itemId,
        batchId: data.batchId,
        sourceLocationId: data.sourceLocationId,
        destinationLocationId: data.destinationLocationId,
        quantity: data.quantity,
        status: 'REQUESTED',
        requestedById: userId,
      },
    });
  }, TX_OPTIONS);
}

export async function dispatchTransfer(transferId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Guard status transition
    // Read first so the claim can set dispatchedQty in the same statement —
    // every extra round trip here counts against the transaction timeout.
    const requested = await tx.stockTransfer.findUnique({ where: { id: transferId } });
    if (!requested) {
      throw new AppError(404, 'NOT_FOUND', 'Transfer not found');
    }

    const claimed = await tx.stockTransfer.updateMany({
      where: { id: transferId, status: 'REQUESTED' },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        dispatchedQty: requested.quantity,
      },
    });

    if (claimed.count === 0) {
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Transfer is not awaiting dispatch');
    }

    const qty = requested.quantity;

    const invSrc = await tx.inventoryItem.findUnique({
      where: {
        itemId_locationId_batchId: {
          itemId: requested.itemId,
          locationId: requested.sourceLocationId,
          batchId: requested.batchId,
        },
      },
    });

    if (!invSrc) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found at source');
    }

    // 2. Decrement physicalQty at source (checking availability guard)
    // Column names are quoted camelCase (Prisma only @@maps the table, not the
    // fields), and the id column is `text` — a ::uuid cast makes Postgres
    // compare text = uuid and throw 42883.
    const moved = await tx.$queryRaw<{ physicalQty: number }[]>`
      UPDATE inventory_items
      SET "physicalQty" = "physicalQty" - ${qty}
      WHERE id = ${invSrc.id}
        AND "physicalQty" - "reservedQty" >= ${qty}
      RETURNING "physicalQty"
    `;

    if (moved.length === 0) {
      throw new AppError(409, 'INSUFFICIENT_AVAILABLE', 'Not enough unreserved stock at source');
    }

    // RETURNING gives the post-update balance atomically, so there is no window
    // in which another transaction could change it before we record it.
    const balanceAfter = moved[0].physicalQty;

    // 3. Create movement out
    await tx.stockMovement.create({
      data: {
        inventoryItemId: invSrc.id,
        type: 'OUT',
        quantity: qty,
        balanceAfter,
        reason: 'TRANSFER_OUT',
        referenceType: 'TRANSFER',
        referenceId: transferId,
        createdById: userId,
      },
    });

    return tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { item: true, source: true, destination: true },
    });
  }, TX_OPTIONS);
}

export async function receiveTransfer(transferId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Guard status transition
    const transfer = await tx.stockTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      throw new AppError(404, 'NOT_FOUND', 'Transfer not found');
    }

    // The idempotency guard: only a DISPATCHED transfer can be claimed. A
    // second receive matches zero rows and 409s before any stock moves.
    const claimed = await tx.stockTransfer.updateMany({
      where: { id: transferId, status: 'DISPATCHED' },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
        receivedQty: transfer.quantity,
      },
    });

    if (claimed.count === 0) {
      // Same code as dispatch and cancel — all three are the same class of
      // failure. The specificity lives in the message, where it is actually
      // read, rather than in a one-off error code.
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        transfer.status === 'RECEIVED'
          ? 'This transfer has already been received'
          : `A transfer with status ${transfer.status} cannot be received`,
      );
    }

    const qty = transfer.quantity;

    // 2. Upsert destination inventory
    const invDest = await tx.inventoryItem.upsert({
      where: {
        itemId_locationId_batchId: {
          itemId: transfer.itemId,
          locationId: transfer.destinationLocationId,
          batchId: transfer.batchId,
        },
      },
      create: {
        itemId: transfer.itemId,
        locationId: transfer.destinationLocationId,
        batchId: transfer.batchId,
        physicalQty: qty,
      },
      update: {
        physicalQty: { increment: qty },
      },
    });

    // 3. Create movement in
    await tx.stockMovement.create({
      data: {
        inventoryItemId: invDest.id,
        type: 'IN',
        quantity: qty,
        balanceAfter: invDest.physicalQty,
        reason: 'TRANSFER_IN',
        referenceType: 'TRANSFER',
        referenceId: transferId,
        createdById: userId,
      },
    });

    return tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { item: true, source: true, destination: true },
    });
  }, TX_OPTIONS);
}

export async function cancelTransfer(transferId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.stockTransfer.updateMany({
      where: { id: transferId, status: 'REQUESTED' },
      data: { status: 'CANCELLED' },
    });

    if (claimed.count === 0) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        'Only REQUESTED transfers can be cancelled',
      );
    }

    return tx.stockTransfer.findUnique({
      where: { id: transferId },
    });
  }, TX_OPTIONS);
}

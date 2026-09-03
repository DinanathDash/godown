import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { Prisma, TransferStatus } from '@prisma/client';

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
    // Generate code
    const counter = await tx.counter.upsert({
      where: { key: 'transfer_seq' },
      update: { value: { increment: 1 } },
      create: { key: 'transfer_seq', value: 1 },
    });
    const code = `TRF-${new Date().getFullYear()}-${counter.value.toString().padStart(5, '0')}`;

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
  });
}

export async function dispatchTransfer(transferId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Guard status transition
    const claimed = await tx.stockTransfer.updateMany({
      where: { id: transferId, status: 'REQUESTED' },
      data: { status: 'DISPATCHED', dispatchedAt: new Date() },
    });

    if (claimed.count === 0) {
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Transfer is not awaiting dispatch');
    }

    const transfer = await tx.stockTransfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    // We must update dispatchedQty to equal requested quantity
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { dispatchedQty: transfer.quantity },
    });

    const qty = transfer.quantity;

    // Find the inventory item at source
    const invSrc = await tx.inventoryItem.findUnique({
      where: {
        itemId_locationId_batchId: {
          itemId: transfer.itemId,
          locationId: transfer.sourceLocationId,
          batchId: transfer.batchId,
        },
      },
    });

    if (!invSrc) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found at source');
    }

    // 2. Decrement physicalQty at source (checking availability guard)
    const moved = await tx.$executeRaw`
      UPDATE inventory_items
      SET physical_qty = physical_qty - ${qty}
      WHERE id = ${invSrc.id}::uuid
        AND physical_qty - reserved_qty >= ${qty}
    `;

    if (moved === 0) {
      throw new AppError(409, 'INSUFFICIENT_AVAILABLE', 'Not enough unreserved stock at source');
    }

    // Read the updated balance
    const updatedSrc = await tx.inventoryItem.findUniqueOrThrow({ where: { id: invSrc.id } });

    // 3. Create movement out
    await tx.stockMovement.create({
      data: {
        inventoryItemId: invSrc.id,
        type: 'OUT',
        quantity: qty,
        balanceAfter: updatedSrc.physicalQty,
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
  });
}

export async function receiveTransfer(transferId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Guard status transition
    const claimed = await tx.stockTransfer.updateMany({
      where: { id: transferId, status: 'DISPATCHED' },
      data: { status: 'RECEIVED', receivedAt: new Date() },
    });

    if (claimed.count === 0) {
      throw new AppError(409, 'ALREADY_RECEIVED', 'Transfer is not awaiting receipt');
    }

    const transfer = await tx.stockTransfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { receivedQty: transfer.quantity },
    });

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
  });
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
  });
}

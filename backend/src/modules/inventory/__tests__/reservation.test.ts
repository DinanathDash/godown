import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../../lib/prisma';
import { reserveStock } from '../reservation';
import { randomUUID } from 'crypto';

describe('Stock Reservation Engine', () => {
  let locationId: string;
  let itemId: string;
  let batchId: string;
  let userId: string;

  beforeAll(async () => {
    // Setup test data
    locationId = randomUUID();
    itemId = randomUUID();
    batchId = randomUUID();
    userId = randomUUID();

    await prisma.location.create({
      data: { id: locationId, name: 'Test Location', code: 'LOC-TEST' },
    });

    const category = await prisma.category.create({
      data: { name: 'Test Category' },
    });

    await prisma.item.create({
      data: { id: itemId, name: 'Test Item', sku: 'TEST-SKU', categoryId: category.id },
    });

    await prisma.batch.create({
      data: { id: batchId, code: 'BATCH-TEST', itemId },
    });

    await prisma.user.create({
      data: { id: userId, email: 'test@godown.app', passwordHash: 'hash', name: 'Test User', role: 'ADMIN' },
    });

    // Create an inventory item with exactly 7 items
    await prisma.inventoryItem.create({
      data: {
        itemId,
        locationId,
        batchId,
        physicalQty: 7,
        reservedQty: 0,
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.stockReservation.deleteMany({});
    await prisma.inventoryItem.deleteMany({ where: { itemId } });
    await prisma.batch.deleteMany({ where: { id: batchId } });
    await prisma.item.deleteMany({ where: { id: itemId } });
    await prisma.category.deleteMany({ where: { name: 'Test Category' } });
    await prisma.location.deleteMany({ where: { id: locationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('should handle concurrent reservations correctly', async () => {
    // We have 7 available. We fire 10 concurrent requests of 1 qty each.
    // Exactly 7 should succeed, 3 should fail.
    
    const attempts = Array.from({ length: 10 }).map(() => {
      const orderLineId = randomUUID();
      return prisma.$transaction(async (tx) => {
        return reserveStock(tx, orderLineId, itemId, locationId, 1, userId);
      });
    });

    const results = await Promise.allSettled(attempts);
    
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(7);
    expect(rejected.length).toBe(3);

    // Verify the inventory reservedQty is exactly 7
    const inventory = await prisma.inventoryItem.findFirst({
      where: { itemId, locationId },
    });

    expect(inventory?.physicalQty).toBe(7);
    expect(inventory?.reservedQty).toBe(7);

    // Verify exactly 7 reservations exist
    const reservations = await prisma.stockReservation.count({
      where: { inventoryItem: { itemId, locationId } },
    });
    
    expect(reservations).toBe(7);
  });
});

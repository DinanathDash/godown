import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { getAuthToken, createTestLocation, createTestItem, createTestInventory } from './testUtils';

/**
 * Stock adjustment is the only way physical quantity changes by hand, so the
 * ledger it writes has to agree with the row it updates. These cover the
 * rejections too: the UI relies on the server's message to explain a refusal.
 */
describe('Inventory adjustment', () => {
  let token = '';
  let salesToken = '';
  let inventoryId = '';

  beforeAll(async () => {
    token = await getAuthToken('OPERATIONS');
    salesToken = await getAuthToken('SALES');
    const location = await createTestLocation('Adjust WH', 'ADJ');
    const item = await createTestItem('Adjust Item', 'ADJ-SKU');
    const inv = await createTestInventory({
      itemId: item.id,
      locationId: location.id,
      batchCode: `ADJ-B-${Date.now()}`,
      physicalQty: 100,
      reservedQty: 30,
    });
    inventoryId = inv.id;
  });

  const adjust = (body: object, tk = token) =>
    request(app).post('/api/inventory/adjust').set('Authorization', `Bearer ${tk}`).send(body);

  it('adds stock and records a ledger entry with the new balance', async () => {
    const res = await adjust({
      inventoryItemId: inventoryId,
      type: 'IN',
      quantity: 25,
      reason: 'Purchase order received',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.physicalQty).toBe(125);

    const movement = await prisma.stockMovement.findFirst({
      where: { inventoryItemId: inventoryId, type: 'IN' },
      orderBy: { createdAt: 'desc' },
    });
    // A ledger that disagrees with the row it describes is worse than none.
    expect(movement?.balanceAfter).toBe(125);
    expect(movement?.referenceType).toBe('MANUAL');
  });

  it('removes stock only down to what is unreserved', async () => {
    // 125 physical - 30 reserved = 95 available.
    const res = await adjust({
      inventoryItemId: inventoryId,
      type: 'OUT',
      quantity: 96,
      reason: 'Damaged in storage',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Insufficient available stock/i);

    const row = await prisma.inventoryItem.findUnique({ where: { id: inventoryId } });
    expect(row?.physicalQty).toBe(125);
  });

  it('rejects a missing reason', async () => {
    const res = await adjust({
      inventoryItemId: inventoryId,
      type: 'IN',
      quantity: 5,
      reason: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-positive quantity', async () => {
    const res = await adjust({
      inventoryItemId: inventoryId,
      type: 'IN',
      quantity: 0,
      reason: 'Stock count correction',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses SALES, which may view inventory but not change it', async () => {
    const res = await adjust(
      {
        inventoryItemId: inventoryId,
        type: 'IN',
        quantity: 5,
        reason: 'Purchase order received',
      },
      salesToken,
    );

    expect(res.status).toBe(403);
  });

  it('404s for an inventory row that does not exist', async () => {
    const res = await adjust({
      inventoryItemId: '00000000-0000-0000-0000-000000000000',
      type: 'IN',
      quantity: 5,
      reason: 'Purchase order received',
    });

    expect(res.status).toBe(404);
  });
});

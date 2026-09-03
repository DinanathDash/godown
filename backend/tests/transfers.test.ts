import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAuthToken, createTestLocation, createTestItem, createTestInventory } from './testUtils';
import { prisma } from '../src/lib/prisma';

describe('Internal Stock Transfers API', () => {
  let token: string;
  let locA: any, locB: any, item: any, invA: any;

  beforeAll(async () => {
    token = await getAuthToken('ADMIN');
    locA = await createTestLocation('Transfer Source', 'SRC-1');
    locB = await createTestLocation('Transfer Dest', 'DST-1');
    item = await createTestItem('Transfer Item', 'TR-ITEM-1');

    invA = await createTestInventory({
      itemId: item.id,
      locationId: locA.id,
      batchCode: 'TR-BATCH-1',
      physicalQty: 100,
      reservedQty: 0,
    });
  });

  it('2. Cannot transfer more than available', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: item.id,
        sourceLocationId: locA.id,
        destinationLocationId: locB.id,
        batchId: invA.batchId,
        quantity: 200, // available is 100
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_AVAILABLE');

    // Verify source physicalQty unchanged
    const inv = await prisma.inventoryItem.findUnique({ where: { id: invA.id } });
    expect(inv?.physicalQty).toBe(100);
  });

  it('3. Destination increases only after receipt', async () => {
    // 1. Request Transfer
    let res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: item.id,
        sourceLocationId: locA.id,
        destinationLocationId: locB.id,
        batchId: invA.batchId,
        quantity: 10,
      });
    expect(res.status).toBe(201);
    const transferId = res.body.id;

    // 2. Dispatch
    res = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // After dispatch: source down, destination unchanged (0 because it didn't exist, or shouldn't be 10)
    const invSourceAfterDispatch = await prisma.inventoryItem.findUnique({
      where: { id: invA.id },
    });
    expect(invSourceAfterDispatch?.physicalQty).toBe(90);

    const invDestAfterDispatch = await prisma.inventoryItem.findFirst({
      where: { itemId: item.id, locationId: locB.id, batchId: invA.batchId },
    });
    expect(invDestAfterDispatch).toBeNull(); // Hasn't been created/increased yet

    // 3. Receive
    res = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // After receipt: destination up
    const invDestAfterReceive = await prisma.inventoryItem.findFirst({
      where: { itemId: item.id, locationId: locB.id, batchId: invA.batchId },
    });
    expect(invDestAfterReceive?.physicalQty).toBe(10);
  });

  it('4. Same transfer cannot be received twice', async () => {
    // 1. Request & Dispatch
    let res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: item.id,
        sourceLocationId: locA.id,
        destinationLocationId: locB.id,
        batchId: invA.batchId,
        quantity: 10,
      });
    const transferId = res.body.id;

    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${token}`);

    // First Receive
    res = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Second Receive -> 409
    res = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    // Verify destination increased exactly once (prev test added 10, this one added 10, total 20)
    const invDest = await prisma.inventoryItem.findFirst({
      where: { itemId: item.id, locationId: locB.id, batchId: invA.batchId },
    });
    expect(invDest?.physicalQty).toBe(20);
  });
});

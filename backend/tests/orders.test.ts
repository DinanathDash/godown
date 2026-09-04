import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  getAuthToken,
  createTestLocation,
  createTestItem,
  createTestInventory,
  createTestCustomer,
} from './testUtils';
import { prisma } from '../src/lib/prisma';
import { reserveOrder } from '../src/modules/orders/service';

describe('Customer Orders API & Concurrency', () => {
  let token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loc: any, item: any, customer: any;

  beforeAll(async () => {
    token = await getAuthToken('ADMIN');
    loc = await createTestLocation('Order Location', 'ORD-LOC-1');
    item = await createTestItem('Order Item', 'ORD-ITEM-1');
    customer = await createTestCustomer();

    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  });

  it('1. Cannot reserve more than available', async () => {
    const inv = await createTestInventory({
      itemId: item.id,
      locationId: loc.id,
      batchCode: 'ORD-B-1',
      physicalQty: 50,
      reservedQty: 0,
    });

    // Create Order
    let res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        locationId: loc.id,
        lines: [{ itemId: item.id, quantity: 100 }], // Available is 50
      });
    expect(res.status).toBe(201);
    const orderId = res.body.id;

    // Reserve Order
    res = await request(app)
      .post(`/api/orders/${orderId}/reserve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_AVAILABLE');

    // Ensure reservedQty is unchanged
    const invCheck = await prisma.inventoryItem.findUnique({ where: { id: inv.id } });
    expect(invCheck?.reservedQty).toBe(0);
  });

  it('6. Does not let two concurrent reservations exceed available stock', async () => {
    // Setup fresh inventory with 100 total physical quantity for this specific test item
    const cItem = await createTestItem('Concurrent Item', 'CONC-1');

    await createTestInventory({
      itemId: cItem.id,
      locationId: loc.id,
      batchCode: 'CONC-B-1',
      physicalQty: 100,
      reservedQty: 0,
    });

    // Create Order A for 80 units
    const reqA = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        locationId: loc.id,
        lines: [{ itemId: cItem.id, quantity: 80 }],
      });
    const orderA = reqA.body.id;

    // Create Order B for 50 units
    const reqB = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        locationId: loc.id,
        lines: [{ itemId: cItem.id, quantity: 50 }],
      });
    const orderB = reqB.body.id;

    // Fired together, not sequentially
    const [a, b] = await Promise.allSettled([reserveOrder(orderA), reserveOrder(orderB)]);

    const ok = [a, b].filter((r) => r.status === 'fulfilled');

    // Exactly one wins because 80 + 50 = 130 > 100
    expect(ok).toHaveLength(1);

    // Assert that the inventory is never oversold
    const inv = await prisma.inventoryItem.findFirst({
      where: { itemId: cItem.id, locationId: loc.id },
    });

    expect(inv?.reservedQty).toBeLessThanOrEqual(inv!.physicalQty);
  });
});

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


describe('5. RBAC API Tests', () => {
  let salesToken: string;
  let opsToken: string;
  let adminToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loc: any, item: any, customer: any, orderId: string;

  beforeAll(async () => {
    salesToken = await getAuthToken('SALES');
    opsToken = await getAuthToken('OPERATIONS');
    adminToken = await getAuthToken('ADMIN');

    loc = await createTestLocation('RBAC Location', 'RBAC-LOC-1');
    item = await createTestItem('RBAC Item', 'RBAC-ITEM-1');
    customer = await createTestCustomer();

    await createTestInventory({
      itemId: item.id,
      locationId: loc.id,
      batchCode: 'RBAC-B-1',
      physicalQty: 100,
      reservedQty: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.id,
        locationId: loc.id,
        lines: [{ itemId: item.id, quantity: 10 }],
      });
    orderId = res.body.id;
  });

  it('Unauthorized user cannot perform restricted action (Sales creating Work Order -> 403)', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        locationId: loc.id,
        itemId: item.id,
        requiredQty: 50,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Unauthorized user cannot perform restricted action (Operations reserving Customer Order -> 403)', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/reserve`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

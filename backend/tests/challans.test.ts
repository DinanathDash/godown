import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, clearTestUser } from './setup';
import { prisma } from '../src/lib/prisma';
import { Role } from '@prisma/client';

describe('Challans Module (Stock Invariants)', () => {
  let adminEmail = '';
  let adminToken = '';
  let testCustomerId = '';
  let testProductId = '';
  let testChallanId = '';

  beforeAll(async () => {
    // Admin User
    const adminData = await createTestUser(Role.ADMIN);
    adminEmail = adminData.email;
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminData.password });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.accessToken;

    // Create a dummy customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Challan Test Customer', mobile: '1122334455' });
    testCustomerId = custRes.body.id;

    // Create a dummy product with 10 stock
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Challan Test Product', sku: `CHL-SKU-${Date.now()}`, unitPrice: 100 });
    testProductId = prodRes.body.id;

    await request(app)
      .post(`/api/products/${testProductId}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'IN', quantity: 10, reason: 'Initial stock for tests' });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.stockMovement.deleteMany({ where: { productId: testProductId } });
    await prisma.challanItem.deleteMany({ where: { productId: testProductId } });
    await prisma.challan.deleteMany({ where: { customerId: testCustomerId } });
    await prisma.product.deleteMany({ where: { id: testProductId } });
    await prisma.customer.deleteMany({ where: { id: testCustomerId } });
    await clearTestUser(adminEmail);
  });

  describe('DRAFT Challan Creation', () => {
    it('should create a draft challan and snapshot customer/product data', async () => {
      const res = await request(app)
        .post('/api/challans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: testCustomerId,
          items: [{ productId: testProductId, quantity: 5 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.totalQuantity).toBe(5);
      expect(res.body.totalAmount).toBe('500'); // Decimal returned as string
      expect(res.body.customerSnapshot.name).toBe('Challan Test Customer');
      testChallanId = res.body.id;
    });

    it('draft challan should NOT deduct stock', async () => {
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prodRes.body.currentStock).toBe(10);
    });
  });

  describe('Challan Confirmation (Stock Deduction)', () => {
    it('should successfully confirm and deduct stock', async () => {
      const res = await request(app)
        .post(`/api/challans/${testChallanId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');

      // Verify stock deducted
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prodRes.body.currentStock).toBe(5); // 10 - 5
    });

    it('should reject confirming an already confirmed challan', async () => {
      const res = await request(app)
        .post(`/api/challans/${testChallanId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('No-Negative-Stock Invariant (409 Conflict)', () => {
    it('should abort transaction if stock is insufficient', async () => {
      // Create a second challan requesting 10 items (only 5 left in stock)
      const draftRes = await request(app)
        .post('/api/challans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: testCustomerId,
          items: [{ productId: testProductId, quantity: 10 }],
        });

      const draftId = draftRes.body.id;

      // Attempt to confirm
      const confirmRes = await request(app)
        .post(`/api/challans/${draftId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should throw 409 Conflict
      expect(confirmRes.status).toBe(409);
      expect(confirmRes.body.error.message).toContain('Insufficient stock');

      // Verify stock was untouched
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prodRes.body.currentStock).toBe(5);
    });
  });

  describe('Challan Cancellation (Stock Refund)', () => {
    it('should successfully cancel a confirmed challan and refund stock', async () => {
      const res = await request(app)
        .post(`/api/challans/${testChallanId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');

      // Verify stock refunded back to 10
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prodRes.body.currentStock).toBe(10);
    });
  });
});

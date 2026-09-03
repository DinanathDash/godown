import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, clearTestUser } from './setup';
import { prisma } from '../src/lib/prisma';
import { Role } from '@prisma/client';

describe('Products Module', () => {
  let adminEmail = '';
  let adminToken = '';
  let salesEmail = '';
  let salesToken = '';
  let testProductId = '';

  beforeAll(async () => {
    // Admin User
    const adminData = await createTestUser(Role.ADMIN);
    adminEmail = adminData.email;
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminData.password });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.accessToken;

    // Sales User
    const salesData = await createTestUser(Role.SALES);
    salesEmail = salesData.email;
    const salesRes = await request(app)
      .post('/api/auth/login')
      .send({ email: salesEmail, password: salesData.password });
    expect(salesRes.status).toBe(200);
    salesToken = salesRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { productId: testProductId } });
    await prisma.product.deleteMany({ where: { id: testProductId } });
    await clearTestUser(adminEmail);
    await clearTestUser(salesEmail);
  });

  describe('RBAC & POST /api/products', () => {
    it('should reject Sales user from creating a product', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'Sales Product',
          sku: 'SALES-001',
          unitPrice: 100,
        });

      expect(res.status).toBe(403);
    });

    it('should allow Admin to create a product', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          sku: `SKU-${Date.now()}`,
          unitPrice: 50.5,
          minStockAlert: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      testProductId = res.body.id;
    });
  });

  describe('Stock Adjustments (POST /api/products/:id/adjust)', () => {
    it('should allow IN adjustment and record movement', async () => {
      const res = await request(app)
        .post(`/api/products/${testProductId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'IN',
          quantity: 10,
          reason: 'Initial stock',
        });

      expect(res.status).toBe(200);
      expect(res.body.product.currentStock).toBe(10);
      expect(res.body.movement.type).toBe('IN');
      expect(res.body.movement.balanceAfter).toBe(10);
    });

    it('should prevent OUT adjustment resulting in negative stock', async () => {
      const res = await request(app)
        .post(`/api/products/${testProductId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'OUT',
          quantity: 15,
          reason: 'Oversell attempt',
        });

      expect(res.status).toBe(409); // Conflict
    });

    it('should allow valid OUT adjustment', async () => {
      const res = await request(app)
        .post(`/api/products/${testProductId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'OUT',
          quantity: 5,
          reason: 'Damage write-off',
        });

      expect(res.status).toBe(200);
      expect(res.body.product.currentStock).toBe(5);
    });
  });

  describe('GET /api/products/low-stock', () => {
    it('should return products under threshold', async () => {
      const res = await request(app)
        .get('/api/products/low-stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Our product has stock 5, minAlert 5, so it should be included
      const found = res.body.find((p: { id: string }) => p.id === testProductId);
      expect(found).toBeDefined();
    });
  });
});

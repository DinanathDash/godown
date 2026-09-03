import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, clearTestUser } from './setup';
import { prisma } from '../src/lib/prisma';
import { Role } from '@prisma/client';

describe('Customers Module', () => {
  let adminEmail = '';
  let adminToken = '';
  let salesEmail = '';
  let salesToken = '';
  let testCustomerId = '';

  beforeAll(async () => {
    // Admin User
    const adminData = await createTestUser(Role.ADMIN);
    adminEmail = adminData.email;
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminData.password });
    expect(adminRes.status).toBe(200);
    console.log('adminRes.body:', adminRes.body);
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
    await prisma.customerNote.deleteMany({ where: { customerId: testCustomerId } });
    await prisma.customer.deleteMany({ where: { id: testCustomerId } });
    await clearTestUser(adminEmail);
    await clearTestUser(salesEmail);
  });

  describe('POST /api/customers', () => {
    it('should create a customer successfully', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'Test Customer',
          mobile: '9876543210',
          email: 'customer@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Customer');
      testCustomerId = res.body.id;
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ email: 'nocustomer@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/customers', () => {
    it('should list customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('should get customer by id', async () => {
      const res = await request(app)
        .get(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testCustomerId);
    });
  });

  describe('PATCH /api/customers/:id', () => {
    it('should update customer', async () => {
      const res = await request(app)
        .patch(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ name: 'Updated Customer' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Customer');
    });
  });

  describe('POST /api/customers/:id/notes', () => {
    it('should add a note and update followUpDate', async () => {
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 1);

      const res = await request(app)
        .post(`/api/customers/${testCustomerId}/notes`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          note: 'Called customer',
          followUpDate: followUp.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe('Called customer');

      // Verify the parent customer was updated
      const customer = await request(app)
        .get(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(customer.body.followUpDate).toBe(followUp.toISOString());
    });
  });

  describe('DELETE /api/customers/:id', () => {
    it('should soft delete the customer', async () => {
      const res = await request(app)
        .delete(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify it's no longer accessible
      const fetchRes = await request(app)
        .get(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(fetchRes.status).toBe(404);
    });
  });
});

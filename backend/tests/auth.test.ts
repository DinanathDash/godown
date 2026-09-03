import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, clearTestUser } from './setup';

describe('Auth Module', () => {
  let testEmail = '';
  let testPassword = '';

  beforeAll(async () => {
    const testData = await createTestUser();
    testEmail = testData.email;
    testPassword = testData.password;
  });

  afterAll(async () => {
    await clearTestUser(testEmail);
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toHaveProperty('email', testEmail);
    });

    it('should fail with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should fail with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password@123' });

      expect(res.status).toBe(401);
    });

    it('should fail validation with missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: testEmail }); // missing password

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let token = '';

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });
      token = res.body.accessToken;
    });

    it('should fetch current user with valid token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', testEmail);
    });

    it('should fail without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });
});

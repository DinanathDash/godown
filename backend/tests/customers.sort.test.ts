import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTestUser, clearTestUser } from './setup';
import { Role } from '@prisma/client';

/**
 * These go through the real Express stack on purpose. The sort param is parsed
 * in the service rather than by a zod transform, because Express 5's req.query
 * getter re-parses the querystring on every access and discards the validate
 * middleware's write-back — a unit test against the service alone would not
 * have caught that.
 */
describe('Customers sorting', () => {
  let email = '';
  let token = '';

  beforeAll(async () => {
    const admin = await createTestUser(Role.ADMIN);
    email = admin.email;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: admin.password });
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await clearTestUser(email);
  });

  const get = (query: string) =>
    request(app).get(`/api/customers${query}`).set('Authorization', `Bearer ${token}`);

  const names = (body: { data: { name: string }[] }) => body.data.map((c) => c.name);

  it('sorts by name ascending', async () => {
    const res = await get('?limit=10&sort=name:asc');
    expect(res.status).toBe(200);
    const got = names(res.body);
    expect(got).toEqual([...got].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts by name descending', async () => {
    const res = await get('?limit=10&sort=name:desc');
    expect(res.status).toBe(200);
    const got = names(res.body);
    expect(got).toEqual([...got].sort((a, b) => b.localeCompare(a)));
  });

  it('accepts two columns at once and honours their precedence', async () => {
    const a = await get('?limit=10&sort=businessName:asc,name:asc');
    const b = await get('?limit=10&sort=name:asc,businessName:asc');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // Different leading key must produce a different ordering.
    expect(names(a.body)).not.toEqual(names(b.body));
  });

  it('keeps null businessName rows last when sorting descending', async () => {
    const res = await get('?limit=50&sort=businessName:desc');
    expect(res.status).toBe(200);
    const businesses = res.body.data.map((c: { businessName: string | null }) => c.businessName);
    const firstNull = businesses.indexOf(null);
    if (firstNull !== -1) {
      expect(businesses.slice(firstNull).every((b: string | null) => b === null)).toBe(true);
    }
  });

  it('still defaults to newest-first when no sort is given', async () => {
    const res = await get('?limit=5');
    expect(res.status).toBe(200);
    const dates = res.body.data.map((c: { createdAt: string }) => new Date(c.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a: number, b: number) => b - a));
  });

  it('sorting composes with a status filter', async () => {
    const res = await get('?limit=10&status=LEAD&sort=name:asc');
    expect(res.status).toBe(200);
    expect(res.body.data.every((c: { status: string }) => c.status === 'LEAD')).toBe(true);
    const got = names(res.body);
    expect(got).toEqual([...got].sort((a, b) => a.localeCompare(b)));
  });

  it.each(['name', 'name:sideways', 'mobile:asc', 'name:asc,'])(
    'rejects malformed sort %j',
    async (bad) => {
      const res = await get(`?sort=${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
    },
  );
});

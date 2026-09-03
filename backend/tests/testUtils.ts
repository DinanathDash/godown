import request from 'supertest';
import app from '../src/app';
import { createTestUser } from './setup';
import { Role } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

export const getAuthToken = async (role: Role = 'ADMIN') => {
  const { email, password } = await createTestUser(role);
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (!res.body.accessToken) {
    throw new Error('No access token returned: ' + JSON.stringify(res.body));
  }
  return res.body.accessToken as string;
};

export const createTestLocation = async (name: string, code: string) => {
  const ts = Date.now();
  return prisma.location.create({
    data: { name: `${name}-${ts}`, code: `${code}-${ts}` },
  });
};

export const createTestItem = async (name: string, sku: string) => {
  const ts = Date.now();
  const category = await prisma.category.create({
    data: { name: `Cat-${sku}-${ts}` },
  });
  return prisma.item.create({
    data: { name: `${name}-${ts}`, sku: `${sku}-${ts}`, categoryId: category.id },
  });
};

export const createTestInventory = async (opts: {
  itemId: string;
  locationId: string;
  batchCode: string;
  physicalQty: number;
  reservedQty: number;
}) => {
  const batch = await prisma.batch.create({
    data: { itemId: opts.itemId, code: opts.batchCode },
  });
  return prisma.inventoryItem.create({
    data: {
      itemId: opts.itemId,
      locationId: opts.locationId,
      batchId: batch.id,
      physicalQty: opts.physicalQty,
      reservedQty: opts.reservedQty,
    },
  });
};

export const createTestCustomer = async () => {
  const ts = Date.now();
  return prisma.customer.create({
    data: { name: 'Test Customer', email: `customer-${ts}@test.com`, mobile: `+123${ts}` },
  });
};

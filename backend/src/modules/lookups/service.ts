import { prisma } from '../../lib/prisma';

/**
 * Read-only reference lists that populate the pickers on every create form.
 *
 * These are deliberately small, unpaginated and shaped exactly as the selects
 * need them — they are lookups, not resources, so they get no filtering,
 * sorting or pagination surface of their own.
 */

export const getLocations = () =>
  prisma.location.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

export const getCategories = () =>
  prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

export const getItems = () =>
  prisma.item.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, name: true, uom: true, categoryId: true },
    orderBy: { name: 'asc' },
  });

export const getBatches = (itemId?: string) =>
  prisma.batch.findMany({
    where: itemId ? { itemId } : undefined,
    select: { id: true, code: true, itemId: true, expiryDate: true },
    // Oldest expiry first, matching the FEFO order stock is allocated in.
    orderBy: [{ expiryDate: 'asc' }, { code: 'asc' }],
  });

export const getCustomers = () =>
  prisma.customer.findMany({
    select: { id: true, name: true, businessName: true, mobile: true },
    orderBy: { name: 'asc' },
  });

export const getUsers = () =>
  prisma.user.findMany({
    where: { isActive: true },
    // Never select passwordHash — this list is handed to the client.
    select: { id: true, name: true, email: true, role: true, locationId: true },
    orderBy: { name: 'asc' },
  });

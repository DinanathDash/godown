/**
 * Database seeder.
 *
 * Content lives in seed-data.json (editable by hand); volume, inventory
 * placement and the whole stock ledger are computed in seed/generate.ts. This
 * file only resolves catalog keys into real ids and writes rows.
 *
 *   npm run seed         no-op if the database already has data
 *   npm run seed:reset   wipes first (refuses when NODE_ENV=production)
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatePlan, assertPlanIsConsistent, SEED, type Catalog } from './seed/generate';

const getPrismaUrl = () => {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('-pooler.') && url.includes('neon.tech') && !url.includes('pgbouncer=true')) {
    return url.includes('?') ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
};

const prisma = new PrismaClient({
  datasources: {
    db: { url: getPrismaUrl() },
  },
});
const DEFAULT_PASSWORD = 'Password@123';

const catalog: Catalog = JSON.parse(
  readFileSync(join(__dirname, 'seed-data.json'), 'utf-8'),
) as Catalog;

const shouldReset = process.argv.includes('--reset');

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(10, 0, 0, 0);
  return d;
};

async function reset() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset the database: NODE_ENV is "production".');
  }
  console.log('Resetting tables...');
  // FK-safe order.
  await prisma.stockReservation.deleteMany();
  await prisma.customerOrderLine.deleteMany();
  await prisma.customerOrder.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.counter.deleteMany();
}

/** A bare `npm run seed` must not write into a populated database. */
async function alreadySeeded(): Promise<boolean> {
  const [items, inventory] = await Promise.all([prisma.item.count(), prisma.inventoryItem.count()]);
  return items > 0 || inventory > 0;
}

async function main() {
  const startedAt = Date.now();

  if (shouldReset) {
    await reset();
  } else if (await alreadySeeded()) {
    console.log(
      [
        'Database already has items/inventory — skipping (this is not an error).',
        'Run `npm run seed:reset` to wipe and reseed.',
      ].join('\n'),
    );
    return;
  }

  const plan = generatePlan(catalog);
  assertPlanIsConsistent(plan);

  // --- Locations, users, categories, items, batches ------------------------
  const locationIdByCode = new Map<string, string>();
  for (const l of catalog.locations) {
    const row = await prisma.location.create({ data: { code: l.code, name: l.name } });
    locationIdByCode.set(l.code, row.id);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIdByKey = new Map<string, string>();
  for (const u of catalog.users) {
    const row = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role as Role,
        locationId: u.locationCode ? locationIdByCode.get(u.locationCode)! : null,
      },
    });
    userIdByKey.set(u.key, row.id);
  }
  const userId = (key: string) => userIdByKey.get(key) ?? userIdByKey.get('admin')!;

  const categoryIdByName = new Map<string, string>();
  for (const name of catalog.categories) {
    const row = await prisma.category.create({ data: { name } });
    categoryIdByName.set(name, row.id);
  }

  const itemIdBySku = new Map<string, string>();
  for (const item of catalog.items) {
    const row = await prisma.item.create({
      data: {
        sku: item.sku,
        name: item.name,
        uom: item.uom,
        categoryId: categoryIdByName.get(item.category)!,
      },
    });
    itemIdBySku.set(item.sku, row.id);
  }

  const batchIdByKey = new Map<string, string>();
  for (const b of plan.batches) {
    const row = await prisma.batch.create({
      data: {
        itemId: itemIdBySku.get(b.sku)!,
        code: b.code,
        expiryDate: b.expiryOffsetDays === null ? null : day(b.expiryOffsetDays),
      },
    });
    batchIdByKey.set(b.key, row.id);
  }

  // --- Inventory -----------------------------------------------------------
  const inventoryIdByKey = new Map<string, string>();
  for (const row of plan.inventory) {
    const created = await prisma.inventoryItem.create({
      data: {
        itemId: itemIdBySku.get(row.sku)!,
        locationId: locationIdByCode.get(row.locationCode)!,
        batchId: batchIdByKey.get(`${row.sku}:${row.batchCode}`)!,
        physicalQty: row.physicalQty,
        reservedQty: row.reservedQty,
      },
    });
    inventoryIdByKey.set(row.key, created.id);
  }

  // --- Transfers (before movements, so movements can reference them) -------
  const transferIdByCode = new Map<string, string>();
  for (const t of plan.transfers) {
    const created = await prisma.stockTransfer.create({
      data: {
        code: t.code,
        itemId: itemIdBySku.get(t.sku)!,
        batchId: batchIdByKey.get(`${t.sku}:${t.batchCode}`)!,
        sourceLocationId: locationIdByCode.get(t.sourceLocationCode)!,
        destinationLocationId: locationIdByCode.get(t.destinationLocationCode)!,
        quantity: t.quantity,
        dispatchedQty: t.dispatchedQty,
        receivedQty: t.receivedQty,
        status: t.status,
        requestedById: userId(t.requestedByKey),
        createdAt: day(t.createdAtOffsetDays),
        dispatchedAt: t.dispatchedOffsetDays === null ? null : day(t.dispatchedOffsetDays),
        receivedAt: t.receivedOffsetDays === null ? null : day(t.receivedOffsetDays),
      },
    });
    transferIdByCode.set(t.code, created.id);
  }

  // --- Stock ledger --------------------------------------------------------
  await prisma.stockMovement.createMany({
    data: plan.movements.map((m) => ({
      inventoryItemId: inventoryIdByKey.get(m.inventoryKey)!,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      balanceAfter: m.balanceAfter,
      referenceType: m.referenceType,
      referenceId: m.referenceCode ? (transferIdByCode.get(m.referenceCode) ?? null) : null,
      createdById: userId(m.userKey),
      createdAt: day(m.createdAtOffsetDays),
    })),
  });

  // --- Work orders ---------------------------------------------------------
  await prisma.workOrder.createMany({
    data: plan.workOrders.map((w) => ({
      code: w.code,
      locationId: locationIdByCode.get(w.locationCode)!,
      itemId: itemIdBySku.get(w.sku)!,
      requiredQty: w.requiredQty,
      assignedToId: userId(w.assigneeKey),
      status: w.status,
      createdAt: day(w.createdAtOffsetDays),
    })),
  });

  // --- Customers, orders, reservations -------------------------------------
  const customerIds: string[] = [];
  for (const c of catalog.customers) {
    const row = await prisma.customer.create({
      data: {
        name: c.name,
        businessName: c.businessName,
        mobile: c.mobile,
        email: c.email,
      },
    });
    customerIds.push(row.id);
  }

  const lineIdByKey = new Map<string, string>();
  for (const o of plan.orders) {
    const created = await prisma.customerOrder.create({
      data: {
        code: o.code,
        customerId: customerIds[o.customerIndex],
        locationId: locationIdByCode.get(o.locationCode)!,
        status: o.status,
        createdById: userId(o.createdByKey),
        createdAt: day(o.createdAtOffsetDays),
        reservedAt: o.reservedOffsetDays === null ? null : day(o.reservedOffsetDays),
        cancelledAt: o.cancelledOffsetDays === null ? null : day(o.cancelledOffsetDays),
        lines: {
          create: o.lines.map((l) => ({
            itemId: itemIdBySku.get(l.sku)!,
            quantity: l.quantity,
          })),
        },
      },
      include: { lines: true },
    });

    // Plan lines and created lines are in the same order.
    o.lines.forEach((l, i) => lineIdByKey.set(l.lineKey, created.lines[i].id));
  }

  await prisma.stockReservation.createMany({
    data: plan.reservations.map((r) => ({
      orderLineId: lineIdByKey.get(r.lineKey)!,
      inventoryItemId: inventoryIdByKey.get(r.inventoryKey)!,
      quantity: r.quantity,
    })),
  });

  await summarise(startedAt);
}

/** Prints what the screens will show, so a bad seed is obvious immediately. */
async function summarise(startedAt: number) {
  const [locations, items, inventory, movements, workOrders, transfers, orders, reservations] =
    await Promise.all([
      prisma.location.count(),
      prisma.item.count(),
      prisma.inventoryItem.count(),
      prisma.stockMovement.count(),
      prisma.workOrder.count(),
      prisma.stockTransfer.count(),
      prisma.customerOrder.count(),
      prisma.stockReservation.count(),
    ]);

  const totals = await prisma.inventoryItem.aggregate({
    _sum: { physicalQty: true, reservedQty: true },
  });
  const inTransit = await prisma.stockTransfer.aggregate({
    where: { status: 'DISPATCHED' },
    _sum: { dispatchedQty: true },
  });
  const byStatus = await prisma.stockTransfer.groupBy({
    by: ['status'],
    _count: true,
  });

  console.log(`
Seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s  (SEED=${SEED})

  Locations        ${locations}
  Items            ${items}
  Inventory rows   ${inventory}
  Stock movements  ${movements}
  Work orders      ${workOrders}
  Transfers        ${transfers}  (${byStatus.map((s) => `${s.status.toLowerCase()} ${s._count}`).join(', ')})
  Customer orders  ${orders}
  Reservations     ${reservations}

  Physical on hand ${totals._sum.physicalQty ?? 0}
  Reserved         ${totals._sum.reservedQty ?? 0}
  In transit       ${inTransit._sum.dispatchedQty ?? 0}

  Sign in with: ${catalog.users.map((u) => u.email).join(', ')}
  Password: ${DEFAULT_PASSWORD}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

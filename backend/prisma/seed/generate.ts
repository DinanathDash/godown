/**
 * Pure planner for the seeder.
 *
 * Takes the flat catalog from seed-data.json and produces a fully-resolved plan:
 * challans with computed totals, a stock ledger whose `balanceAfter` values are
 * internally consistent, and the final `currentStock` each product must carry.
 *
 * Nothing here touches the database — that is seed.ts's job. Keeping this pure
 * means the invariants (totals = sum of lines, stock = ledger tail, no negative
 * stock) can be asserted before a single row is written.
 */
import { Rng } from './rng';

// ---------------------------------------------------------------------------
// Knobs
// ---------------------------------------------------------------------------

/** Change this for a different — but still reproducible — dataset. */
export const SEED = 20260902;

export const VOLUME = {
  daysOfHistory: 90,
  challans: 120,
  /** Created today, so dashboard `challans.todayCount` is non-zero. */
  challansToday: 5,
  draftChallans: 18,
  /** Cancelled straight from DRAFT — no stock effect. */
  cancelledFromDraft: 4,
  /** Confirmed then cancelled — stock goes OUT and comes back IN. */
  cancelledAfterConfirm: 4,
  manualAdjustments: 22,
  customerNotes: 60,
  /** Products forced at/below their reorder threshold for the low-stock panel. */
  lowStockProducts: 8,
};

// ---------------------------------------------------------------------------
// Catalog shape (mirrors seed-data.json)
// ---------------------------------------------------------------------------

export interface CatalogUser {
  key: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
}

export interface CatalogProduct {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  minStockAlert: number;
  location: string;
  openingStock: number;
}

export interface CatalogCustomer {
  name: string;
  businessName: string | null;
  mobile: string;
  email: string | null;
  gstNumber: string | null;
  type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
  status: 'ACTIVE' | 'LEAD' | 'INACTIVE';
  address: string;
  followUpOffsetDays: number | null;
}

export interface Catalog {
  users: CatalogUser[];
  products: CatalogProduct[];
  customers: CatalogCustomer[];
  noteTemplates: string[];
  manualStockReasons: { IN: string[]; OUT: string[] };
  challanNotes: (string | null)[];
}

// ---------------------------------------------------------------------------
// Plan shape
// ---------------------------------------------------------------------------

export interface PlannedChallanItem {
  sku: string;
  quantity: number;
  /** May differ from catalog price — wholesale/distributor discounts. */
  unitPrice: number;
  lineTotal: number;
}

export interface PlannedChallan {
  challanNumber: string;
  customerIndex: number;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  items: PlannedChallanItem[];
  totalQuantity: number;
  totalAmount: number;
  notes: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  userKey: string;
}

export interface PlannedMovement {
  sku: string;
  quantity: number;
  type: 'IN' | 'OUT';
  reason: string;
  referenceType: string | null;
  /** Resolved to a challan id by seed.ts; null for manual/opening movements. */
  challanNumber: string | null;
  balanceAfter: number;
  createdAt: Date;
  userKey: string;
}

export interface PlannedNote {
  customerIndex: number;
  note: string;
  followUpDate: Date | null;
  createdAt: Date;
  userKey: string;
}

export interface PlannedProduct {
  sku: string;
  currentStock: number;
  minStockAlert: number;
}

export interface PlannedCustomer {
  index: number;
  followUpDate: Date | null;
  createdAt: Date;
}

export interface SeedPlan {
  products: PlannedProduct[];
  customers: PlannedCustomer[];
  challans: PlannedChallan[];
  movements: PlannedMovement[];
  notes: PlannedNote[];
  /** Seeds the `challan_seq` counter so the app never collides with our numbers. */
  counterValue: number;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (base: Date, days: number): Date => new Date(base.getTime() + days * DAY_MS);

const addMinutes = (base: Date, minutes: number): Date =>
  new Date(base.getTime() + minutes * 60 * 1000);

/** Same calendar day as `base`, at a plausible working hour. */
const atBusinessHour = (base: Date, rng: Rng): Date => {
  const d = new Date(base);
  d.setHours(rng.int(9, 18), rng.int(0, 59), rng.int(0, 59), 0);
  return d;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Quantity heuristics — cheap consumables move in bulk, machines do not.
// ---------------------------------------------------------------------------

const quantityFor = (product: CatalogProduct, rng: Rng): number => {
  if (product.unitPrice < 25) return rng.int(50, 400);
  if (product.unitPrice < 120) return rng.int(20, 150);
  if (product.unitPrice < 500) return rng.int(5, 40);
  if (product.unitPrice < 1500) return rng.int(2, 15);
  return rng.int(1, 6);
};

/** Wholesale and distributor buyers negotiate; retail pays list price. */
const priceFor = (product: CatalogProduct, customer: CatalogCustomer, rng: Rng): number => {
  if (customer.type === 'RETAIL' || !rng.chance(0.45)) return product.unitPrice;
  const discount = customer.type === 'DISTRIBUTOR' ? rng.int(5, 12) : rng.int(2, 8);
  return round2(product.unitPrice * (1 - discount / 100));
};

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

type LedgerEvent =
  | { at: Date; kind: 'challan-out'; challan: PlannedChallan }
  | { at: Date; kind: 'challan-cancel-in'; challan: PlannedChallan }
  | { at: Date; kind: 'manual'; sku: string; type: 'IN' | 'OUT'; quantity: number; reason: string };

export function generatePlan(catalog: Catalog, now: Date): SeedPlan {
  const rng = new Rng(SEED);
  const historyStart = addDays(now, -VOLUME.daysOfHistory);

  const productBySku = new Map(catalog.products.map((p) => [p.sku, p]));
  const salesUsers = catalog.users.filter((u) => u.role === 'SALES' || u.role === 'ADMIN');
  const stockUsers = catalog.users.filter((u) => u.role === 'WAREHOUSE' || u.role === 'ADMIN');

  // --- 1. Customers: creation dates and follow-ups -------------------------
  const customers: PlannedCustomer[] = catalog.customers.map((c, index) => ({
    index,
    // Customers exist before the challans that reference them.
    createdAt: atBusinessHour(addDays(historyStart, -rng.int(1, 120)), rng),
    followUpDate:
      c.followUpOffsetDays === null
        ? null
        : atBusinessHour(addDays(now, c.followUpOffsetDays), rng),
  }));

  // --- 2. Opening stock ----------------------------------------------------
  const balances = new Map<string, number>();
  const movements: PlannedMovement[] = [];
  const openingAt = atBusinessHour(addDays(historyStart, -3), rng);

  for (const product of catalog.products) {
    balances.set(product.sku, product.openingStock);
    movements.push({
      sku: product.sku,
      quantity: product.openingStock,
      type: 'IN',
      reason: 'Opening stock',
      referenceType: 'MANUAL',
      challanNumber: null,
      balanceAfter: product.openingStock,
      createdAt: openingAt,
      userKey: 'warehouse',
    });
  }

  // --- 3. Challan skeletons ------------------------------------------------
  const dates: Date[] = [];
  for (let i = 0; i < VOLUME.challans - VOLUME.challansToday; i++) {
    dates.push(atBusinessHour(addDays(historyStart, rng.int(0, VOLUME.daysOfHistory - 1)), rng));
  }
  for (let i = 0; i < VOLUME.challansToday; i++) {
    const d = new Date(now);
    d.setHours(rng.int(9, Math.max(9, now.getHours())), rng.int(0, 59), 0, 0);
    dates.push(d > now ? new Date(now.getTime() - rng.int(1, 120) * 60 * 1000) : d);
  }
  dates.sort((a, b) => a.getTime() - b.getTime());

  // Status assignment: the most recent challans are the ones still sitting in
  // DRAFT, which is what an actual pending-work queue looks like.
  const statuses: PlannedChallan['status'][] = new Array(VOLUME.challans).fill('CONFIRMED');
  const cancelledCount = VOLUME.cancelledFromDraft + VOLUME.cancelledAfterConfirm;
  const cancelledAfterConfirm = new Set<number>();

  for (let i = VOLUME.challans - VOLUME.draftChallans; i < VOLUME.challans; i++) {
    statuses[i] = 'DRAFT';
  }
  const cancellable = rng.sample(
    Array.from({ length: VOLUME.challans - VOLUME.draftChallans }, (_, i) => i),
    cancelledCount,
  );
  cancellable.forEach((idx, n) => {
    statuses[idx] = 'CANCELLED';
    if (n < VOLUME.cancelledAfterConfirm) cancelledAfterConfirm.add(idx);
  });

  // Only non-inactive customers place orders.
  const buyerIndexes = catalog.customers
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.status !== 'INACTIVE')
    .map(({ i }) => i);
  const buyerPool = rng.shuffle(buyerIndexes);

  const challans: PlannedChallan[] = dates.map((createdAt, i) => {
    const customerIndex = buyerPool[rng.weightedIndex(buyerPool.length, 1.7)];
    const customer = catalog.customers[customerIndex];
    const status = statuses[i];

    const lineCount = rng.int(1, 6);
    const chosen = rng.sample(catalog.products, lineCount);

    const items: PlannedChallanItem[] = chosen.map((product) => {
      const quantity = quantityFor(product, rng);
      const unitPrice = priceFor(product, customer, rng);
      return { sku: product.sku, quantity, unitPrice, lineTotal: round2(unitPrice * quantity) };
    });

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
    const totalAmount = round2(items.reduce((sum, it) => sum + it.lineTotal, 0));

    const confirmed = status === 'CONFIRMED' || cancelledAfterConfirm.has(i);
    const confirmedAt = confirmed ? addMinutes(createdAt, rng.int(20, 600)) : null;
    const cancelledAt =
      status === 'CANCELLED' ? addMinutes(confirmedAt ?? createdAt, rng.int(60, 2880)) : null;

    return {
      challanNumber: `CHL-${createdAt.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      customerIndex,
      status,
      items,
      totalQuantity,
      totalAmount,
      notes: rng.pick(catalog.challanNotes),
      createdAt,
      confirmedAt,
      cancelledAt,
      userKey: rng.pick(salesUsers).key,
    };
  });

  // --- 4. Walk the ledger chronologically ---------------------------------
  const events: LedgerEvent[] = [];

  challans.forEach((challan, i) => {
    if (challan.confirmedAt) {
      events.push({ at: challan.confirmedAt, kind: 'challan-out', challan });
    }
    if (cancelledAfterConfirm.has(i) && challan.cancelledAt) {
      events.push({ at: challan.cancelledAt, kind: 'challan-cancel-in', challan });
    }
  });

  for (let i = 0; i < VOLUME.manualAdjustments; i++) {
    const product = rng.pick(catalog.products);
    const type: 'IN' | 'OUT' = rng.chance(0.65) ? 'IN' : 'OUT';
    events.push({
      at: atBusinessHour(addDays(historyStart, rng.int(0, VOLUME.daysOfHistory - 1)), rng),
      kind: 'manual',
      sku: product.sku,
      type,
      quantity:
        type === 'IN'
          ? Math.max(10, Math.round(product.openingStock * (rng.int(10, 40) / 100)))
          : rng.int(1, 12),
      reason: rng.pick(catalog.manualStockReasons[type]),
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  /** Tops up stock just before an outbound movement that would go negative. */
  const ensureStock = (sku: string, needed: number, at: Date) => {
    const balance = balances.get(sku)!;
    if (balance >= needed) return;

    const product = productBySku.get(sku)!;
    const shortfall = needed - balance;
    const topUp = shortfall + Math.max(product.minStockAlert, rng.int(20, 200));
    const balanceAfter = balance + topUp;

    balances.set(sku, balanceAfter);
    movements.push({
      sku,
      quantity: topUp,
      type: 'IN',
      reason: 'Restock from supplier',
      referenceType: 'MANUAL',
      challanNumber: null,
      balanceAfter,
      // Dated just before the movement it covers, so it still sorts ahead of it.
      createdAt: addMinutes(at, -1),
      userKey: 'warehouse',
    });
  };

  for (const event of events) {
    if (event.kind === 'manual') {
      if (event.type === 'OUT') ensureStock(event.sku, event.quantity, event.at);
      const balanceAfter =
        balances.get(event.sku)! + (event.type === 'IN' ? event.quantity : -event.quantity);
      balances.set(event.sku, balanceAfter);
      movements.push({
        sku: event.sku,
        quantity: event.quantity,
        type: event.type,
        reason: event.reason,
        referenceType: 'MANUAL',
        challanNumber: null,
        balanceAfter,
        createdAt: event.at,
        userKey: rng.pick(stockUsers).key,
      });
      continue;
    }

    const { challan } = event;
    const outbound = event.kind === 'challan-out';

    for (const item of challan.items) {
      if (outbound) ensureStock(item.sku, item.quantity, event.at);
      const balanceAfter = balances.get(item.sku)! + (outbound ? -item.quantity : item.quantity);
      balances.set(item.sku, balanceAfter);
      movements.push({
        sku: item.sku,
        quantity: item.quantity,
        type: outbound ? 'OUT' : 'IN',
        reason: outbound
          ? `Challan Confirmed: ${challan.challanNumber}`
          : `Challan Cancelled: ${challan.challanNumber}`,
        referenceType: outbound ? 'CHALLAN' : 'CHALLAN_CANCEL',
        challanNumber: challan.challanNumber,
        balanceAfter,
        createdAt: event.at,
        userKey: challan.userKey,
      });
    }
  }

  // Sort into the order the ledger will actually be read in (Array#sort is
  // stable, so same-timestamp movements keep their generated order), then
  // recompute every balanceAfter by replaying in that final order. Backdated
  // restocks make generation order and storage order differ, and the stored
  // order is the one the UI and `assertPlanIsConsistent` see — so it wins.
  movements.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const replayed = new Map<string, number>();
  for (const m of movements) {
    const before = replayed.get(m.sku) ?? 0;
    m.balanceAfter = before + (m.type === 'IN' ? m.quantity : -m.quantity);
    replayed.set(m.sku, m.balanceAfter);
  }

  // --- 5. Final product state, plus forced low-stock items -----------------
  const lowStockSkus = new Set(
    rng
      .sample(
        catalog.products.filter((p) => replayed.get(p.sku)! < 400),
        VOLUME.lowStockProducts,
      )
      .map((p) => p.sku),
  );

  const products: PlannedProduct[] = catalog.products.map((p) => {
    const currentStock = replayed.get(p.sku)!;
    // Raising the threshold (rather than faking the stock) keeps the ledger true:
    // currentStock still equals the tail of this product's movements.
    const minStockAlert = lowStockSkus.has(p.sku) ? currentStock + rng.int(0, 25) : p.minStockAlert;
    return { sku: p.sku, currentStock, minStockAlert };
  });

  // --- 6. Customer notes ---------------------------------------------------
  const notes: PlannedNote[] = [];
  const notableCustomers = rng.shuffle(
    catalog.customers.map((c, i) => ({ c, i })).filter(({ c }) => c.status !== 'INACTIVE'),
  );

  for (let i = 0; i < VOLUME.customerNotes; i++) {
    const { c, i: customerIndex } = notableCustomers[i % notableCustomers.length];
    const createdAt = atBusinessHour(
      addDays(historyStart, rng.int(0, VOLUME.daysOfHistory - 1)),
      rng,
    );
    notes.push({
      customerIndex,
      note: rng.pick(catalog.noteTemplates),
      // Most notes carry the follow-up that was set at the time; the newest one
      // for a customer is what customer.followUpDate reflects.
      followUpDate:
        c.followUpOffsetDays !== null && rng.chance(0.5)
          ? atBusinessHour(addDays(now, c.followUpOffsetDays), rng)
          : null,
      createdAt,
      userKey: rng.pick(salesUsers).key,
    });
  }

  notes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    products,
    customers,
    challans,
    movements,
    notes,
    counterValue: VOLUME.challans,
  };
}

/**
 * Fails loudly if the plan violates an invariant the app relies on. Cheaper to
 * catch here than to debug a wrong dashboard number later.
 */
export function assertPlanIsConsistent(plan: SeedPlan): void {
  const problems: string[] = [];

  for (const challan of plan.challans) {
    const qty = challan.items.reduce((s, i) => s + i.quantity, 0);
    const amount = round2(challan.items.reduce((s, i) => s + i.lineTotal, 0));
    if (qty !== challan.totalQuantity) {
      problems.push(`${challan.challanNumber}: totalQuantity ${challan.totalQuantity} != ${qty}`);
    }
    if (Math.abs(amount - challan.totalAmount) > 0.01) {
      problems.push(`${challan.challanNumber}: totalAmount ${challan.totalAmount} != ${amount}`);
    }
    if (challan.status === 'CONFIRMED' && !challan.confirmedAt) {
      problems.push(`${challan.challanNumber}: CONFIRMED without confirmedAt`);
    }
    if (challan.confirmedAt && challan.confirmedAt < challan.createdAt) {
      problems.push(`${challan.challanNumber}: confirmedAt precedes createdAt`);
    }
  }

  const numbers = new Set(plan.challans.map((c) => c.challanNumber));
  if (numbers.size !== plan.challans.length) {
    problems.push('duplicate challan numbers in plan');
  }

  // Replay the ledger per product: every step must chain off the previous
  // balance, never go negative, and land exactly on currentStock.
  const tail = new Map<string, number>();
  for (const m of plan.movements) {
    const before = tail.get(m.sku) ?? 0;
    const expected = before + (m.type === 'IN' ? m.quantity : -m.quantity);
    if (m.balanceAfter !== expected) {
      problems.push(
        `${m.sku}: balanceAfter ${m.balanceAfter} breaks the chain (expected ${expected}) at ${m.createdAt.toISOString()}`,
      );
    }
    if (m.balanceAfter < 0) {
      problems.push(
        `${m.sku}: negative balanceAfter ${m.balanceAfter} at ${m.createdAt.toISOString()}`,
      );
    }
    tail.set(m.sku, m.balanceAfter);
  }
  for (const p of plan.products) {
    if (tail.get(p.sku) !== p.currentStock) {
      problems.push(`${p.sku}: currentStock ${p.currentStock} != ledger tail ${tail.get(p.sku)}`);
    }
  }

  if (problems.length) {
    throw new Error(`Seed plan is inconsistent:\n  - ${problems.join('\n  - ')}`);
  }
}

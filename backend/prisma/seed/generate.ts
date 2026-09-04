/**
 * Pure planner for the seeder.
 *
 * Produces a fully-resolved plan: inventory rows, a stock ledger whose
 * balanceAfter values chain correctly, transfers in every status with the
 * matching stock already moved, and reservations that add up to each row's
 * reservedQty.
 *
 * Nothing here touches the database. Keeping it pure means the invariants can
 * be asserted before a single row is written — see assertPlanIsConsistent.
 */
import { Rng } from './rng';

export const SEED = 20260903;

export const VOLUME = {
  daysOfHistory: 60,
  /** How many of the three locations stock a given item. */
  locationsPerItem: { min: 1, max: 3 },
  batchesPerItem: { min: 1, max: 2 },
  manualAdjustments: 18,
  workOrders: 8,
  /** Work orders deliberately raised above available, to drive the transfer flow. */
  workOrdersWithShortage: 3,
  customerOrders: 10,
  reservedOrders: 4,
  cancelledOrders: 1,
};

// ---------------------------------------------------------------------------
// Catalog shape (mirrors seed-data.json)
// ---------------------------------------------------------------------------

export interface Catalog {
  users: {
    key: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'OPERATIONS' | 'SALES';
    locationCode: string | null;
  }[];
  locations: { code: string; name: string }[];
  categories: string[];
  items: { sku: string; name: string; category: string; uom: string }[];
  customers: {
    name: string;
    businessName: string | null;
    mobile: string;
    email: string | null;
  }[];
  adjustmentReasons: { IN: string[]; OUT: string[] };
}

// ---------------------------------------------------------------------------
// Plan shape — keys are catalog-relative; seed.ts resolves them to real ids.
// ---------------------------------------------------------------------------

export interface PlannedBatch {
  key: string; // `${sku}:${code}`
  sku: string;
  code: string;
  expiryOffsetDays: number | null;
}

export interface PlannedInventory {
  key: string; // `${sku}:${locationCode}:${batchCode}`
  sku: string;
  locationCode: string;
  batchCode: string;
  physicalQty: number;
  reservedQty: number;
}

export interface PlannedMovement {
  inventoryKey: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reason: string;
  balanceAfter: number;
  referenceType: string | null;
  /** Transfer/order code; resolved to an id by seed.ts. */
  referenceCode: string | null;
  createdAtOffsetDays: number;
  userKey: string;
}

export interface PlannedWorkOrder {
  code: string;
  locationCode: string;
  sku: string;
  requiredQty: number;
  assigneeKey: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  createdAtOffsetDays: number;
}

export interface PlannedTransfer {
  code: string;
  sku: string;
  batchCode: string;
  sourceLocationCode: string;
  destinationLocationCode: string;
  quantity: number;
  dispatchedQty: number;
  receivedQty: number;
  status: 'REQUESTED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  requestedByKey: string;
  createdAtOffsetDays: number;
  dispatchedOffsetDays: number | null;
  receivedOffsetDays: number | null;
}

export interface PlannedOrderLine {
  lineKey: string;
  sku: string;
  quantity: number;
}

export interface PlannedReservation {
  lineKey: string;
  inventoryKey: string;
  quantity: number;
}

export interface PlannedOrder {
  code: string;
  customerIndex: number;
  locationCode: string;
  status: 'DRAFT' | 'RESERVED' | 'CANCELLED';
  lines: PlannedOrderLine[];
  createdAtOffsetDays: number;
  reservedOffsetDays: number | null;
  cancelledOffsetDays: number | null;
  createdByKey: string;
}

export interface SeedPlan {
  batches: PlannedBatch[];
  inventory: PlannedInventory[];
  movements: PlannedMovement[];
  workOrders: PlannedWorkOrder[];
  transfers: PlannedTransfer[];
  orders: PlannedOrder[];
  reservations: PlannedReservation[];
}

// ---------------------------------------------------------------------------

/** Bulk consumables move in hundreds; power tools move in single digits. */
function openingStockFor(sku: string, rng: Rng): number {
  if (sku.startsWith('FS-')) return rng.int(800, 2400);
  if (sku.startsWith('PL-') || sku.startsWith('EL-')) return rng.int(200, 900);
  if (sku.startsWith('SF-')) return rng.int(120, 400);
  if (sku.startsWith('HT-')) return rng.int(40, 160);
  return rng.int(8, 40); // power tools
}

export function generatePlan(catalog: Catalog): SeedPlan {
  const rng = new Rng(SEED);

  const opsKeys = catalog.users
    .filter((u) => u.role === 'OPERATIONS' || u.role === 'ADMIN')
    .map((u) => u.key);
  const salesKeys = catalog.users
    .filter((u) => u.role === 'SALES' || u.role === 'ADMIN')
    .map((u) => u.key);
  const locationCodes = catalog.locations.map((l) => l.code);

  // --- 1. Batches -----------------------------------------------------------
  const batches: PlannedBatch[] = [];
  const batchesBySku = new Map<string, string[]>();

  for (const item of catalog.items) {
    const count = rng.int(VOLUME.batchesPerItem.min, VOLUME.batchesPerItem.max);
    const codes: string[] = [];
    for (let b = 0; b < count; b++) {
      const code = `B-2026-${String(b + 1).padStart(2, '0')}`;
      codes.push(code);
      batches.push({
        key: `${item.sku}:${code}`,
        sku: item.sku,
        code,
        // Only perishable-ish categories carry an expiry; the rest are null.
        expiryOffsetDays: rng.chance(0.4) ? rng.int(90, 540) : null,
      });
    }
    batchesBySku.set(item.sku, codes);
  }

  // --- 2. Inventory placement ----------------------------------------------
  // Not every item sits in every godown. That unevenness is the point: it is
  // what produces real shortages and gives transfers somewhere to come from.
  const inventory: PlannedInventory[] = [];
  const balances = new Map<string, number>();
  const movements: PlannedMovement[] = [];
  const openingDay = -(VOLUME.daysOfHistory + 5);

  for (const item of catalog.items) {
    const stockedAt = rng.sample(
      locationCodes,
      rng.int(VOLUME.locationsPerItem.min, VOLUME.locationsPerItem.max),
    );
    for (const locationCode of stockedAt) {
      for (const batchCode of batchesBySku.get(item.sku)!) {
        const key = `${item.sku}:${locationCode}:${batchCode}`;
        const qty = Math.max(1, Math.round(openingStockFor(item.sku, rng) / stockedAt.length));

        inventory.push({
          key,
          sku: item.sku,
          locationCode,
          batchCode,
          physicalQty: qty,
          reservedQty: 0,
        });
        balances.set(key, qty);
        movements.push({
          inventoryKey: key,
          type: 'IN',
          quantity: qty,
          reason: 'Opening stock',
          balanceAfter: qty,
          referenceType: 'ADJUSTMENT',
          referenceCode: null,
          createdAtOffsetDays: openingDay,
          userKey: 'ops_mum',
        });
      }
    }
  }

  const inventoryByKey = new Map(inventory.map((i) => [i.key, i]));
  const keysFor = (sku: string, locationCode: string) =>
    inventory.filter((i) => i.sku === sku && i.locationCode === locationCode);

  /** Applies a stock change and appends the matching ledger row. */
  const move = (
    key: string,
    type: 'IN' | 'OUT',
    quantity: number,
    reason: string,
    day: number,
    userKey: string,
    referenceType: string | null = null,
    referenceCode: string | null = null,
  ) => {
    const before = balances.get(key)!;
    const after = type === 'IN' ? before + quantity : before - quantity;
    balances.set(key, after);
    movements.push({
      inventoryKey: key,
      type,
      quantity,
      reason,
      balanceAfter: after,
      referenceType,
      referenceCode,
      createdAtOffsetDays: day,
      userKey,
    });
  };

  // --- 3. Manual adjustments ------------------------------------------------
  for (let i = 0; i < VOLUME.manualAdjustments; i++) {
    const row = rng.pick(inventory);
    const current = balances.get(row.key)!;
    const type: 'IN' | 'OUT' = rng.chance(0.6) ? 'IN' : 'OUT';
    const qty =
      type === 'IN'
        ? Math.max(5, Math.round(current * (rng.int(5, 20) / 100)))
        : Math.max(1, Math.min(current - 1, rng.int(1, 12)));

    if (type === 'OUT' && qty >= current) continue; // never drain a row to zero here
    move(
      row.key,
      type,
      qty,
      rng.pick(catalog.adjustmentReasons[type]),
      rng.int(-VOLUME.daysOfHistory, -2),
      rng.pick(opsKeys),
    );
  }

  // --- 4. Transfers ---------------------------------------------------------
  // One of each status, so every rule in the brief is visible in seeded data:
  // dispatched stock has left the source and landed nowhere; received stock
  // has landed; requested stock has not moved at all.
  const transfers: PlannedTransfer[] = [];
  const transferStatuses: PlannedTransfer['status'][] = [
    'RECEIVED',
    'DISPATCHED',
    'REQUESTED',
    'REQUESTED',
    'CANCELLED',
  ];

  for (const status of transferStatuses) {
    // Pick a row with enough stock to move, and a different destination.
    const candidates = inventory.filter((i) => balances.get(i.key)! > 40);
    if (!candidates.length) break;
    const source = rng.pick(candidates);
    const destination = rng.pick(locationCodes.filter((c) => c !== source.locationCode));
    const quantity = Math.max(5, Math.round(balances.get(source.key)! * 0.15));
    const code = `TRF-2026-${rng.code()}`;
    const requestedDay = rng.int(-VOLUME.daysOfHistory, -10);

    let dispatchedQty = 0;
    let receivedQty = 0;
    let dispatchedOffsetDays: number | null = null;
    let receivedOffsetDays: number | null = null;

    if (status === 'DISPATCHED' || status === 'RECEIVED') {
      dispatchedQty = quantity;
      dispatchedOffsetDays = requestedDay + rng.int(1, 3);
      move(
        source.key,
        'OUT',
        quantity,
        `Transfer ${code} dispatched`,
        dispatchedOffsetDays,
        rng.pick(opsKeys),
        'TRANSFER',
        code,
      );
    }

    if (status === 'RECEIVED') {
      receivedQty = quantity;
      receivedOffsetDays = dispatchedOffsetDays! + rng.int(1, 4);

      // Destination row may not exist yet — receiving creates it.
      const destKey = `${source.sku}:${destination}:${source.batchCode}`;
      if (!inventoryByKey.has(destKey)) {
        const row: PlannedInventory = {
          key: destKey,
          sku: source.sku,
          locationCode: destination,
          batchCode: source.batchCode,
          physicalQty: 0,
          reservedQty: 0,
        };
        inventory.push(row);
        inventoryByKey.set(destKey, row);
        balances.set(destKey, 0);
      }
      move(
        destKey,
        'IN',
        quantity,
        `Transfer ${code} received`,
        receivedOffsetDays,
        rng.pick(opsKeys),
        'TRANSFER',
        code,
      );
    }

    transfers.push({
      code,
      sku: source.sku,
      batchCode: source.batchCode,
      sourceLocationCode: source.locationCode,
      destinationLocationCode: destination,
      quantity,
      dispatchedQty,
      receivedQty,
      status,
      requestedByKey: rng.pick(opsKeys),
      createdAtOffsetDays: requestedDay,
      dispatchedOffsetDays,
      receivedOffsetDays,
    });
  }

  // --- 5. Customer orders and reservations ---------------------------------
  const orders: PlannedOrder[] = [];
  const reservations: PlannedReservation[] = [];
  let lineCounter = 0;

  for (let o = 0; o < VOLUME.customerOrders; o++) {
    const status: PlannedOrder['status'] =
      o < VOLUME.reservedOrders
        ? 'RESERVED'
        : o < VOLUME.reservedOrders + VOLUME.cancelledOrders
          ? 'CANCELLED'
          : 'DRAFT';

    const locationCode = rng.pick(locationCodes);
    const stockedSkus = [
      ...new Set(inventory.filter((i) => i.locationCode === locationCode).map((i) => i.sku)),
    ];
    if (!stockedSkus.length) continue;

    const code = `ORD-2026-${rng.code()}`;
    const createdAtOffsetDays = rng.int(-VOLUME.daysOfHistory, -1);
    const lines: PlannedOrderLine[] = [];

    for (const sku of rng.sample(stockedSkus, rng.int(1, 3))) {
      const rows = keysFor(sku, locationCode);
      const available = rows.reduce((sum, r) => sum + (balances.get(r.key)! - r.reservedQty), 0);
      if (available < 2) continue;

      // Keep orders comfortably inside available stock — the concurrency tests
      // are where over-reservation gets exercised, not the seed.
      const quantity = Math.max(1, Math.min(Math.floor(available * 0.2), rng.int(1, 40)));
      const lineKey = `line-${lineCounter++}`;
      lines.push({ lineKey, sku, quantity });

      // Only a RESERVED order actually holds stock.
      if (status === 'RESERVED') {
        let remaining = quantity;
        for (const row of rows) {
          if (remaining === 0) break;
          const rowAvailable = balances.get(row.key)! - row.reservedQty;
          if (rowAvailable <= 0) continue;
          const take = Math.min(remaining, rowAvailable);
          row.reservedQty += take;
          reservations.push({ lineKey, inventoryKey: row.key, quantity: take });
          remaining -= take;
        }
      }
    }

    if (!lines.length) continue;

    orders.push({
      code,
      customerIndex: rng.int(0, catalog.customers.length - 1),
      locationCode,
      status,
      lines,
      createdAtOffsetDays,
      reservedOffsetDays: status === 'RESERVED' ? createdAtOffsetDays : null,
      cancelledOffsetDays: status === 'CANCELLED' ? createdAtOffsetDays : null,
      createdByKey: rng.pick(salesKeys),
    });
  }

  // --- 6. Work orders -------------------------------------------------------
  // Some are deliberately short, because "Work Order -> shortage -> transfer"
  // is the flow the demo has to show and it should be visible on first load.
  const workOrders: PlannedWorkOrder[] = [];
  const woStatuses: PlannedWorkOrder['status'][] = [
    'ASSIGNED',
    'ASSIGNED',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'COMPLETED',
  ];

  for (let w = 0; w < VOLUME.workOrders; w++) {
    const locationCode = rng.pick(locationCodes);
    const stockedSkus = [
      ...new Set(inventory.filter((i) => i.locationCode === locationCode).map((i) => i.sku)),
    ];
    if (!stockedSkus.length) continue;

    const sku = rng.pick(stockedSkus);
    const available = keysFor(sku, locationCode).reduce(
      (sum, r) => sum + (balances.get(r.key)! - r.reservedQty),
      0,
    );

    const shouldBeShort = w < VOLUME.workOrdersWithShortage;
    const requiredQty = shouldBeShort
      ? available + rng.int(10, 60) // guaranteed shortage
      : Math.max(1, Math.floor(available * (rng.int(20, 70) / 100)));

    workOrders.push({
      code: `WO-2026-${rng.code()}`,
      locationCode,
      sku,
      requiredQty,
      assigneeKey: rng.pick(opsKeys),
      status: woStatuses[w % woStatuses.length],
      createdAtOffsetDays: rng.int(-VOLUME.daysOfHistory, -1),
    });
  }

  // --- 7. Settle final quantities ------------------------------------------
  for (const row of inventory) {
    row.physicalQty = balances.get(row.key)!;
  }

  movements.sort((a, b) => a.createdAtOffsetDays - b.createdAtOffsetDays);

  return { batches, inventory, movements, workOrders, transfers, orders, reservations };
}

/**
 * Fails loudly if the plan breaks an invariant the app depends on. Cheaper to
 * catch here than to debug a wrong availability number in the demo.
 */
export function assertPlanIsConsistent(plan: SeedPlan): void {
  const problems: string[] = [];

  // 1. Replay the ledger per inventory row: every step must chain off the
  //    previous balance, never go negative, and land on physicalQty.
  const byKey = new Map(plan.inventory.map((i) => [i.key, i]));
  const running = new Map<string, number>();

  for (const m of [...plan.movements].sort(
    (a, b) => a.createdAtOffsetDays - b.createdAtOffsetDays,
  )) {
    const before = running.get(m.inventoryKey) ?? 0;
    const expected = before + (m.type === 'IN' ? m.quantity : -m.quantity);
    if (m.balanceAfter !== expected) {
      problems.push(
        `${m.inventoryKey}: balanceAfter ${m.balanceAfter} breaks the chain (expected ${expected})`,
      );
    }
    if (expected < 0) problems.push(`${m.inventoryKey}: ledger goes negative (${expected})`);
    running.set(m.inventoryKey, expected);
  }

  for (const row of plan.inventory) {
    const tail = running.get(row.key);
    if (tail === undefined) {
      problems.push(`${row.key}: has no movements at all`);
    } else if (tail !== row.physicalQty) {
      problems.push(`${row.key}: physicalQty ${row.physicalQty} != ledger tail ${tail}`);
    }
  }

  // 2. reservedQty must equal the sum of that row's reservations.
  const reservedByKey = new Map<string, number>();
  for (const r of plan.reservations) {
    reservedByKey.set(r.inventoryKey, (reservedByKey.get(r.inventoryKey) ?? 0) + r.quantity);
  }
  for (const row of plan.inventory) {
    const expected = reservedByKey.get(row.key) ?? 0;
    if (row.reservedQty !== expected) {
      problems.push(
        `${row.key}: reservedQty ${row.reservedQty} != sum of reservations ${expected}`,
      );
    }
    // 3. The rule the whole app defends: never reserve more than exists.
    if (row.reservedQty > row.physicalQty) {
      problems.push(`${row.key}: reserved ${row.reservedQty} exceeds physical ${row.physicalQty}`);
    }
    if (row.physicalQty < 0) problems.push(`${row.key}: negative physicalQty`);
  }

  // 4. Reservations may only belong to RESERVED orders.
  const reservedLineKeys = new Set(
    plan.orders
      .filter((o) => o.status === 'RESERVED')
      .flatMap((o) => o.lines.map((l) => l.lineKey)),
  );
  for (const r of plan.reservations) {
    if (!reservedLineKeys.has(r.lineKey)) {
      problems.push(`reservation on ${r.lineKey} whose order is not RESERVED`);
    }
    if (!byKey.has(r.inventoryKey)) {
      problems.push(`reservation points at unknown inventory row ${r.inventoryKey}`);
    }
  }

  // 5. Transfer quantities must match their status.
  for (const t of plan.transfers) {
    if (t.status === 'REQUESTED' && (t.dispatchedQty > 0 || t.receivedQty > 0)) {
      problems.push(`${t.code}: REQUESTED but stock already moved`);
    }
    if (t.status === 'DISPATCHED' && (t.dispatchedQty === 0 || t.receivedQty > 0)) {
      problems.push(`${t.code}: DISPATCHED but quantities are wrong`);
    }
    if (t.status === 'RECEIVED' && t.receivedQty !== t.dispatchedQty) {
      problems.push(`${t.code}: RECEIVED but receivedQty != dispatchedQty`);
    }
    if (t.sourceLocationCode === t.destinationLocationCode) {
      problems.push(`${t.code}: source and destination are the same godown`);
    }
  }

  // 6. Codes must be unique.
  for (const [label, codes] of [
    ['work order', plan.workOrders.map((w) => w.code)],
    ['transfer', plan.transfers.map((t) => t.code)],
    ['order', plan.orders.map((o) => o.code)],
  ] as const) {
    if (new Set(codes).size !== codes.length) problems.push(`duplicate ${label} codes`);
  }

  if (problems.length) {
    throw new Error(`Seed plan is inconsistent:\n  - ${problems.join('\n  - ')}`);
  }
}

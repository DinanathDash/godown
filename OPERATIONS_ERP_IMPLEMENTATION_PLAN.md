# Mini Operations ERP — Implementation Plan

**Audience:** an LLM or developer executing this build end-to-end.
**Source brief:** "Full-Stack Developer Technical Case Study — Mini Operations ERP".
**Base project:** Counterfoil (existing CRM/challan ERP) — reused as a platform, not as a domain.

---

## 0. Verdict: can Counterfoil be the base?

**Yes, for the platform. No, for the inventory model.** Be honest about the split, because it drives every estimate below.

| Layer | Reusable? | Notes |
|---|---|---|
| Auth: JWT, bcrypt, `authenticate`, `requireRole` | **~95%** | Only the role enum changes |
| `validate` middleware, `AppError`, `errorHandler`, status-code taxonomy | **~100%** | Lift as-is |
| Module shape (`routes → controller → service → schema`) | **~100%** | Pattern, not code |
| Prisma setup, migration + seed tooling | **~90%** | Seed *generator* is reusable; seed *data* is not |
| Test harness (vitest + supertest + `setup.ts`) | **~100%** | The 5 mandatory tests slot straight in |
| Frontend shell: AppShell, Sidebar, auth store, `ProtectedRoute`, `permissions.ts`, TanStack Query, axios client | **~90%** | Retarget to 5 screens |
| UI kit: Table, Dialog, Select, Badge, Skeleton, Pagination, toast, sortable headers | **~100%** | Straight lift |
| **Concurrency / transaction patterns** | **pattern only** | The conditional-write idiom is exactly right — see §5 |
| `Product.currentStock` model | **replaced** | Wrong grain |
| Challan / ChallanItem | **deleted** | Replaced by CustomerOrder + reservations |
| Customer CRM (notes, follow-ups, status) | **deleted** | Not in the brief; brief says *build only these screens* |
| Dashboard module | **deleted** | Not in the brief |

**Net effect: roughly 30–40% of the work is already done**, and it is the boring 30–40% — auth, errors, validation plumbing, UI primitives, test setup, deploy config.

### What that saves you, concretely

Counterfoil already solves the exact problem at the centre of this brief. The challan-confirm path uses a **conditional write** — `updateMany` with a `gte` guard in the `WHERE`, then treat `count === 0` as "someone beat me to it". That idiom is the answer to *"two users must not both reserve"*, to *"cannot transfer more than available"*, and to *"same transfer cannot be received twice"*. Same shape, three times. You have already built and tested it once.

### The honest risks

1. **Scope leakage.** The brief says *"Build only these screens"* and *"Focus on functionality instead of excessive UI design."* Leaving Counterfoil's CRM, dashboard and challan screens in place reads as not following the brief. Strip them.
2. **Conceptual collision.** `Product` vs `Item`, `Challan` vs `CustomerOrder`, `location: String` vs `Location` table. Keeping both vocabularies in one repo will confuse a reviewer and confuse you in the live round.
3. **Git history.** The brief requires real development history. Inheriting Counterfoil's history is honest but describes a different product.

### Recommendation

**New repository, seeded from Counterfoil's platform layer.**

- Commit 1: `chore: scaffold platform from prior project` — auth, middleware, error handling, UI kit, tooling, configs. Say so in the README; carrying your own prior work forward is a strength, not something to hide.
- Then build the domain incrementally per §14, one commit per phase.

Do **not** branch inside Counterfoil and delete half of it. The deletion diff is large, noisy, and buries the actual assignment work in the history the reviewer inspects.

### Where the marks actually are

| Parameter | Marks | |
|---|---:|---|
| Backend & APIs | 20 | ⎫ |
| Business Logic | 20 | ⎬ **55 marks = backend correctness** |
| Inventory / Transaction Correctness | 15 | ⎭ |
| Database Design | 15 | |
| Frontend Integration | 10 | ← only 10 |
| Auth & Authorization | 8 | |
| Testing | 5 | |
| Code Quality | 5 | |
| Documentation | 2 | |

**Spend accordingly.** The frontend is worth 10. The inventory/transaction core is worth 35 with database design behind it. Do not polish UI while the reservation race is unproven.

---

## 1. Rules for the implementer

1. **The stack in §2 is locked.** Do not substitute libraries.
2. **Build in the order in §14.** Every phase ends committed and working.
3. **Never invent scope.** Five screens, five modules, five mandatory tests. Nothing else.
4. **Every response shape in §9 is a contract.** The frontend is written against it.
5. **Commit continuously**, Conventional Commits. One giant commit is a documented fail signal.
6. **No secrets in git.** `.env` gitignored, `.env.example` committed.
7. **Available quantity is never stored.** It is always `physical − reserved`. See §5.
8. **Stock is only ever mutated inside a transaction that also writes a `StockMovement`.** No exceptions.
9. If something is cut, record it in README → Known limitations. A documented gap scores better than a silent one.

---

## 2. Locked technical decisions

Carried from Counterfoil unless marked **new**.

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable on all free hosts |
| Language | TypeScript, `strict: true` | |
| API | Express 5 | Already proven in Counterfoil |
| ORM | Prisma 5 | Type-safe queries + migrations + seed |
| Database | PostgreSQL 16 (Neon) | Row locking is the backbone of §5 |
| Validation | Zod | Reused shapes, runtime + types |
| Auth | JWT (HS256) + bcrypt | |
| Frontend | Next.js (App Router) + TypeScript | Reuse Counterfoil's shell wholesale |
| Server state | TanStack Query v5 | |
| Forms | react-hook-form + zod resolver | |
| Styling | Tailwind + existing UI kit | |
| Tests | vitest + supertest | The 5 mandatory tests are API-level |
| **API docs** | **openapi.yaml + swagger-ui-express** | **new** — served at `/api/docs`, demos well |
| **ER diagram** | **Mermaid in README** | **new** — version-controlled, no image to stale |
| Hosting | Neon + Render + Vercel | Same as before |

---

## 3. Domain model

### 3.1 The one decision everything hangs on

Counterfoil stores stock as a single integer on the product. This brief needs stock at the grain of **item × location × batch**, with a reserved portion carved out of it. That is a new table, and it is the spine of the whole application.

```
Item ──┐
       ├──> InventoryItem (physicalQty, reservedQty)  ──> StockMovement (ledger)
Location ──┤                        │
Batch ─────┘                        └──> StockReservation ──> CustomerOrderLine
```

### 3.2 Prisma schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role            { ADMIN OPERATIONS SALES }
enum WorkOrderStatus { ASSIGNED IN_PROGRESS COMPLETED }
enum TransferStatus  { REQUESTED DISPATCHED RECEIVED CANCELLED }
enum OrderStatus     { DRAFT RESERVED FULFILLED CANCELLED }
enum MovementType    { IN OUT }

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role
  isActive     Boolean  @default(true)
  // Present from day one so live-verification Change 4 is a filter, not a migration.
  locationId   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  location        Location?       @relation(fields: [locationId], references: [id])
  workOrders      WorkOrder[]     @relation("WorkOrderAssignee")
  stockMovements  StockMovement[]
  orders          CustomerOrder[]

  @@map("users")
}

model Location {
  id       String  @id @default(uuid())
  code     String  @unique          // "WH-MUM", "WH-PUN"
  name     String
  isActive Boolean @default(true)

  inventory     InventoryItem[]
  users         User[]
  workOrders    WorkOrder[]
  transfersOut  StockTransfer[] @relation("TransferSource")
  transfersIn   StockTransfer[] @relation("TransferDestination")

  @@map("locations")
}

model Category {
  id    String @id @default(uuid())
  name  String @unique
  items Item[]

  @@map("categories")
}

model Item {
  id         String  @id @default(uuid())
  sku        String  @unique
  name       String
  categoryId String
  uom        String  @default("NOS")   // unit of measure
  isActive   Boolean @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category   Category        @relation(fields: [categoryId], references: [id])
  batches    Batch[]
  inventory  InventoryItem[]
  workOrders WorkOrder[]
  transfers  StockTransfer[]
  orderLines CustomerOrderLine[]

  @@index([name])
  @@map("items")
}

model Batch {
  id         String    @id @default(uuid())
  itemId     String
  code       String                        // "B-2026-01"
  expiryDate DateTime?
  createdAt  DateTime  @default(now())

  item      Item            @relation(fields: [itemId], references: [id])
  inventory InventoryItem[]
  transfers StockTransfer[]

  @@unique([itemId, code])
  @@map("batches")
}

/// The grain of all stock. One row per item + location + batch.
/// availableQty is DERIVED (physicalQty - reservedQty) and never stored.
model InventoryItem {
  id          String @id @default(uuid())
  itemId      String
  locationId  String
  batchId     String
  physicalQty Int    @default(0)
  reservedQty Int    @default(0)
  updatedAt   DateTime @updatedAt

  item     Item     @relation(fields: [itemId], references: [id])
  location Location @relation(fields: [locationId], references: [id])
  batch    Batch    @relation(fields: [batchId], references: [id])

  movements    StockMovement[]
  reservations StockReservation[]

  @@unique([itemId, locationId, batchId])
  @@index([locationId, itemId])
  @@map("inventory_items")
}

/// Append-only. Never updated, never deleted.
model StockMovement {
  id              String       @id @default(uuid())
  inventoryItemId String
  type            MovementType
  quantity        Int          // always positive; direction is in `type`
  reason          String       // OPENING_STOCK | ADJUSTMENT | TRANSFER_OUT | TRANSFER_IN | ORDER_FULFILMENT | ...
  balanceAfter    Int          // physicalQty after this movement
  referenceType   String?      // "TRANSFER" | "ORDER" | "ADJUSTMENT"
  referenceId     String?
  createdById     String
  createdAt       DateTime     @default(now())

  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id])
  createdBy     User          @relation(fields: [createdById], references: [id])

  @@index([inventoryItemId, createdAt])
  @@map("stock_movements")
}

model WorkOrder {
  id           String          @id @default(uuid())
  code         String          @unique      // "WO-2026-00001"
  locationId   String
  itemId       String
  requiredQty  Int
  assignedToId String
  status       WorkOrderStatus @default(ASSIGNED)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  location   Location @relation(fields: [locationId], references: [id])
  item       Item     @relation(fields: [itemId], references: [id])
  assignedTo User     @relation("WorkOrderAssignee", fields: [assignedToId], references: [id])

  @@index([status])
  @@map("work_orders")
}

model StockTransfer {
  id                    String         @id @default(uuid())
  code                  String         @unique    // "TRF-2026-00001"
  itemId                String
  batchId               String
  sourceLocationId      String
  destinationLocationId String
  quantity              Int                        // requested
  dispatchedQty         Int            @default(0)
  receivedQty           Int            @default(0) // quantity fields, not just a status flag:
  status                TransferStatus @default(REQUESTED)
  requestedById         String
  dispatchedAt          DateTime?
  receivedAt            DateTime?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  item        Item     @relation(fields: [itemId], references: [id])
  batch       Batch    @relation(fields: [batchId], references: [id])
  source      Location @relation("TransferSource",      fields: [sourceLocationId],      references: [id])
  destination Location @relation("TransferDestination", fields: [destinationLocationId], references: [id])

  @@index([status])
  @@map("stock_transfers")
}

model Customer {
  id           String   @id @default(uuid())
  name         String
  businessName String?
  mobile       String
  email        String?
  createdAt    DateTime @default(now())

  orders CustomerOrder[]

  @@index([name])
  @@map("customers")
}

model CustomerOrder {
  id          String      @id @default(uuid())
  code        String      @unique     // "ORD-2026-00001"
  customerId  String
  locationId  String                  // reservations draw from this location
  status      OrderStatus @default(DRAFT)
  createdById String
  reservedAt  DateTime?
  cancelledAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  customer  Customer            @relation(fields: [customerId], references: [id])
  createdBy User                @relation(fields: [createdById], references: [id])
  lines     CustomerOrderLine[]

  @@index([status])
  @@map("customer_orders")
}

model CustomerOrderLine {
  id       String @id @default(uuid())
  orderId  String
  itemId   String
  quantity Int

  order        CustomerOrder      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  item         Item               @relation(fields: [itemId], references: [id])
  reservations StockReservation[]

  @@index([orderId])
  @@map("customer_order_lines")
}

/// One row per (order line, inventory row) touched. Makes release trivial.
model StockReservation {
  id              String    @id @default(uuid())
  orderLineId     String
  inventoryItemId String
  quantity        Int
  releasedAt      DateTime?
  createdAt       DateTime  @default(now())

  orderLine     CustomerOrderLine @relation(fields: [orderLineId], references: [id], onDelete: Cascade)
  inventoryItem InventoryItem     @relation(fields: [inventoryItemId], references: [id])

  @@index([orderLineId])
  @@index([inventoryItemId])
  @@map("stock_reservations")
}

model Counter {
  key   String @id
  value Int    @default(0)

  @@map("counters")
}
```

### 3.3 Schema notes worth defending in the live round

- **`batchId` is required, not nullable.** In Postgres, `NULL` values do not collide in a unique index, so a nullable `batchId` would silently allow duplicate `(item, location, NULL)` rows and break the whole grain. Items that are not batch-tracked get a single `GENERAL` batch seeded per item.
- **`availableQty` is not a column.** It is `physicalQty − reservedQty`, computed on read. Storing it invites drift between three numbers that must always agree.
- **Transfers carry `dispatchedQty` and `receivedQty`, not just a status.** Live-verification Change 2 ("allow partial receipt") then becomes a comparison change, not a migration.
- **`User.locationId` exists from day one.** Change 4 ("restrict users to their assigned location") becomes a `where` clause.
- **`StockMovement` is append-only.** It is the audit trail; `physicalQty` must always reconcile to the last `balanceAfter` per inventory row.

---

## 4. Roles and permissions

The brief requires a minimum of three. Use exactly three — fewer moving parts to explain.

| Action | Admin | Operations | Sales |
|---|:--:|:--:|:--:|
| Login, view own profile | ✔ | ✔ | ✔ |
| Inventory: read | ✔ | ✔ | ✔ |
| Inventory: adjust (manual IN/OUT) | ✔ | ✔ | ✖ |
| Items / Locations / Batches: create | ✔ | ✔ | ✖ |
| Work Orders: **create** | ✔ | ✖ | ✖ |
| Work Orders: read | ✔ | ✔ | ✔ |
| Work Orders: change status | ✔ | ✔ | ✖ |
| Transfers: request / dispatch / receive | ✔ | ✔ | ✖ |
| Transfers: read | ✔ | ✔ | ✔ |
| Customer Orders: **create + reserve** | ✔ | ✖ | ✔ |
| Customer Orders: read | ✔ | ✔ | ✔ |
| Customer Orders: cancel | ✔ | ✖ | ✔ |

Straight from the brief: *"Admin can create Work Orders. Operations User can manage inventory and transfers. Sales User can create orders and reserve stock."*

Enforced by `requireRole(...)` on every route. The frontend mirrors it in `permissions.ts` to hide controls — **the server is the source of truth.** Mandatory Test 5 proves it.

---

## 5. Availability and concurrency — the core of the assignment

This section is worth 35 marks. Get it right before anything else.

### 5.1 The rule

```
available = physicalQty − reservedQty
```

Computed in exactly **one** place, a helper both the read and write paths use. Live-verification Change 1 ("add DAMAGED, damaged stock reduces available") is then a one-line edit to that helper plus one column.

### 5.2 Why Prisma alone cannot express the guard

The guard you need is a **column-to-column comparison**:

```sql
WHERE physical_qty - reserved_qty >= :qty
```

Prisma's `where` cannot compare two fields of the same model in an `updateMany`. So the atomic guard is raw SQL. This is deliberate, not a workaround — say so in the README.

### 5.3 Reserving stock (the headline requirement)

> *Available = 100. User A reserves 80, User B reserves 50. Both requests must not succeed.*

Reserve inside one transaction, locking candidate rows up front with `SELECT ... FOR UPDATE`:

```ts
async function reserveLine(
  tx: Prisma.TransactionClient,
  line: { id: string; itemId: string; quantity: number },
  locationId: string,
) {
  // FOR UPDATE locks these rows for the life of the transaction. A concurrent
  // reservation blocks here until we commit, then re-reads the updated values —
  // which is exactly what stops both users from succeeding.
  // FEFO: oldest expiry first, nulls last.
  const rows = await tx.$queryRaw<{ id: string; available: number }[]>`
    SELECT i.id, i.physical_qty - i.reserved_qty AS available
    FROM inventory_items i
    JOIN batches b ON b.id = i.batch_id
    WHERE i.item_id = ${line.itemId}::uuid
      AND i.location_id = ${locationId}::uuid
      AND i.physical_qty - i.reserved_qty > 0
    ORDER BY b.expiry_date ASC NULLS LAST, i.id ASC
    FOR UPDATE OF i
  `;

  const totalAvailable = rows.reduce((sum, r) => sum + Number(r.available), 0);
  if (totalAvailable < line.quantity) {
    throw new AppError(409, 'INSUFFICIENT_AVAILABLE',
      `Insufficient available stock for item ${line.itemId}`,
      [{ itemId: line.itemId, requested: line.quantity, available: totalAvailable }]);
  }

  // Allocate across batches, oldest first.
  let remaining = line.quantity;
  for (const row of rows) {
    if (remaining === 0) break;
    const take = Math.min(remaining, Number(row.available));

    await tx.inventoryItem.update({
      where: { id: row.id },
      data: { reservedQty: { increment: take } },
    });
    await tx.stockReservation.create({
      data: { orderLineId: line.id, inventoryItemId: row.id, quantity: take },
    });

    remaining -= take;
  }
}
```

Why this satisfies the brief:

- `FOR UPDATE` serialises concurrent reservations on the same rows. Under Postgres READ COMMITTED the second transaction blocks at the `SELECT`, and once the first commits it re-evaluates against the **new** row versions — so it sees `available = 20`, not the stale `100`.
- The check and the write are in one transaction. There is no window between them.
- A shortfall throws, the transaction rolls back, and no partial allocation survives.

**Simpler variant** when reserving from a single known inventory row (use for stock adjustments and transfer dispatch):

```ts
const updated = await tx.$executeRaw`
  UPDATE inventory_items
  SET reserved_qty = reserved_qty + ${qty}
  WHERE id = ${inventoryItemId}::uuid
    AND physical_qty - reserved_qty >= ${qty}
`;
if (updated === 0) throw new AppError(409, 'INSUFFICIENT_AVAILABLE', '...');
```

One statement, the `WHERE` *is* the guard, `0` rows means someone else got there first. This is the same idiom Counterfoil already uses for challan confirmation.

### 5.4 Releasing a reservation

Live-verification Change 3 is *"cancel an order and correctly release its reserved inventory."* The reservation ledger makes it a loop:

```ts
async function releaseOrder(tx: Prisma.TransactionClient, orderId: string) {
  const reservations = await tx.stockReservation.findMany({
    where: { orderLine: { orderId }, releasedAt: null },
  });

  for (const r of reservations) {
    await tx.inventoryItem.update({
      where: { id: r.inventoryItemId },
      data: { reservedQty: { decrement: r.quantity } },
    });
    await tx.stockReservation.update({
      where: { id: r.id },
      data: { releasedAt: new Date() },
    });
  }

  await tx.customerOrder.update({
    where: { id: orderId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
}
```

`releasedAt` rather than deleting, so the history survives. Filtering on `releasedAt: null` also makes double-release a no-op.

---

## 6. Internal stock transfer

The brief's rules, restated precisely:

| Step | Source | Destination |
|---|---|---|
| Requested | unchanged | unchanged |
| **Dispatched** | `physicalQty` decreases | **unchanged** |
| **Received** | unchanged | `physicalQty` increases |

Between dispatch and receipt the quantity is **in transit** — it belongs to no location. The transfer row itself is the in-transit record; no phantom inventory row is needed.

### 6.1 Dispatch

```ts
// Guard the status transition and the stock in the same transaction.
const claimed = await tx.stockTransfer.updateMany({
  where: { id: transferId, status: 'REQUESTED' },
  data: { status: 'DISPATCHED', dispatchedQty: qty, dispatchedAt: new Date() },
});
if (claimed.count === 0)
  throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Transfer is not awaiting dispatch');

const moved = await tx.$executeRaw`
  UPDATE inventory_items
  SET physical_qty = physical_qty - ${qty}
  WHERE id = ${sourceInvId}::uuid
    AND physical_qty - reserved_qty >= ${qty}
`;
if (moved === 0)
  throw new AppError(409, 'INSUFFICIENT_AVAILABLE', 'Not enough unreserved stock at source');
```

Note the guard is against **available**, not physical — you must not dispatch stock that Sales has already promised to a customer. This is a deliberate business rule; state it in the README.

### 6.2 Receipt, and why it cannot happen twice

```ts
const claimed = await tx.stockTransfer.updateMany({
  where: { id: transferId, status: 'DISPATCHED' },   // ← the idempotency guard
  data: { status: 'RECEIVED', receivedQty: qty, receivedAt: new Date() },
});
if (claimed.count === 0)
  throw new AppError(409, 'ALREADY_RECEIVED', 'Transfer is not awaiting receipt');

// Only now does the destination increase.
await tx.inventoryItem.upsert({
  where: { itemId_locationId_batchId: { itemId, locationId: destId, batchId } },
  create: { itemId, locationId: destId, batchId, physicalQty: qty },
  update: { physicalQty: { increment: qty } },
});
```

A second receipt finds `status = 'RECEIVED'`, matches zero rows, and 409s **before** any stock moves. Mandatory Test 4 proves it. Same conditional-write idiom as §5.3 — one pattern, used consistently.

---

## 7. Work order shortage

```
shortage = max(0, requiredQty − availableAtLocation)
```

Computed on read, never stored — a stored shortage goes stale the moment a transfer lands.

```ts
const [{ available }] = await prisma.$queryRaw<{ available: number }[]>`
  SELECT COALESCE(SUM(physical_qty - reserved_qty), 0)::int AS available
  FROM inventory_items
  WHERE item_id = ${wo.itemId}::uuid AND location_id = ${wo.locationId}::uuid
`;
return { ...wo, availableQty: available, shortageQty: Math.max(0, wo.requiredQty - available) };
```

The Work Orders screen shows required / available / shortage per row, and when shortage > 0 offers **"Request transfer"**, pre-filled with the item, the shortfall quantity, and a source location that has the stock. That single button is what makes the brief's flow — *Inventory → Work Order → Stock Check → Transfer → Reservation* — legible in the demo video.

---

## 8. Backend structure

```
backend/src/
├── config/env.ts                # zod-validated process.env, fail fast on boot
├── lib/{prisma,jwt,password}.ts
├── middleware/
│   ├── authenticate.ts          # ← from Counterfoil, unchanged
│   ├── requireRole.ts           # ← from Counterfoil, unchanged
│   ├── validate.ts              # ← from Counterfoil, SEE WARNING BELOW
│   ├── notFound.ts
│   └── errorHandler.ts          # ← from Counterfoil, unchanged
├── modules/
│   ├── auth/         { routes, controller, service, schema }.ts
│   ├── inventory/    { routes, controller, service, schema }.ts   # items, locations, batches, stock, adjustments
│   ├── work-orders/  { routes, controller, service, schema }.ts
│   ├── transfers/    { routes, controller, service, schema }.ts
│   └── orders/       { routes, controller, service, schema }.ts
├── utils/{AppError,availability,codes}.ts
├── routes.ts
├── app.ts
└── server.ts
```

> **Carry this bug fix forward.** Counterfoil's `validate` middleware does `Object.assign(req.query, parsed.query)`. Under **Express 5 that silently does nothing** — `req.query` is a getter that re-parses the querystring on every access, so the assignment mutates a throwaway object and every zod `.transform()` on a query param is dead code. It went unnoticed there because `Number(params.page)` works on a string anyway.
>
> Fix it properly in the new repo:
> ```ts
> if (parsed.query !== undefined) {
>   Object.defineProperty(req, 'query', {
>     value: parsed.query, writable: true, configurable: true, enumerable: true,
>   });
> }
> ```
> This shadows the prototype getter with an own property. **Every query param a service reads must then be declared in that module's zod schema**, because zod strips undeclared keys — that is the trap that would otherwise bite you silently.

**Layering rule:** controllers do HTTP only (parse → call service → respond). Services own business logic and Prisma. No Prisma in controllers, no `req`/`res` in services.

---

## 9. API reference

Base `/api`. Everything except `/health`, `/docs` and `/auth/login` needs a bearer token.

### Auth
| Method | Path | Roles |
|---|---|---|
| POST | `/auth/login` | public |
| GET | `/auth/me` | any |

### Inventory
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/inventory` | any | `?page&limit&search&locationId&itemId&categoryId&lowStock`; returns physical, reserved, **available** |
| GET | `/inventory/:id` | any | With recent movements |
| POST | `/inventory/adjustments` | Admin, Operations | `{ inventoryItemId, type: IN\|OUT, quantity, reason }` |
| GET | `/items` · `/locations` · `/categories` · `/batches` | any | Lookup lists for the pickers |
| POST | `/items` · `/locations` · `/batches` | Admin, Operations | |

### Work orders
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/work-orders` | any | Each row includes computed `availableQty` + `shortageQty` |
| POST | `/work-orders` | **Admin only** | |
| GET | `/work-orders/:id` | any | |
| PATCH | `/work-orders/:id/status` | Admin, Operations | `ASSIGNED → IN_PROGRESS → COMPLETED`, forward only |

### Transfers
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/transfers` | any | `?status&sourceLocationId&destinationLocationId` |
| POST | `/transfers` | Admin, Operations | Creates `REQUESTED` |
| POST | `/transfers/:id/dispatch` | Admin, Operations | Source decreases |
| POST | `/transfers/:id/receive` | Admin, Operations | Destination increases; 409 on second call |
| POST | `/transfers/:id/cancel` | Admin | Only while `REQUESTED` |

### Customer orders
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/orders` | any | |
| POST | `/orders` | Admin, Sales | Creates `DRAFT` with lines |
| POST | `/orders/:id/reserve` | Admin, Sales | **The concurrency path.** `DRAFT → RESERVED` |
| POST | `/orders/:id/cancel` | Admin, Sales | Releases reservations |
| GET | `/customers` · `POST /customers` | any / Admin, Sales | Backing list for the order form |

### Envelope

List: `{ data: [...], meta: { page, limit, total, totalPages } }`
Error: `{ error: { code, message, details? } }`

| Code | Used for |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `INSUFFICIENT_AVAILABLE`, `ALREADY_RECEIVED`, `INVALID_STATUS_TRANSITION`, `DUPLICATE_SKU` |
| 500 | `INTERNAL_ERROR` — never leaks a stack trace |

### Document codes

`WO-{YYYY}-{00001}`, `TRF-{YYYY}-{00001}`, `ORD-{YYYY}-{00001}` — generated from the `Counter` table **inside** the creating transaction (Counterfoil's pattern), so they are gapless and race-free.

---

## 10. Validation rules

| Field | Rule |
|---|---|
| `email` | valid email, lowercased, trimmed |
| `password` | min 8 on create; login checks non-empty |
| `item.sku` | 2–50, `/^[A-Za-z0-9-_]+$/`, uppercased, unique |
| `location.code` | 2–20, uppercased, unique |
| any `quantity` | **integer ≥ 1** — rejects zero, negatives and decimals |
| `requiredQty` | integer ≥ 1 |
| status transitions | enum + explicit allowed-transition map, never free-form |
| `page` / `limit` | coerced int, `page ≥ 1`, `1 ≤ limit ≤ 100` |

*"Invalid quantity"* is an explicit brief requirement — zero, negative and non-integer are all rejected at the schema, with a test.

---

## 11. Frontend — exactly five screens

| Route | Screen | Contents |
|---|---|---|
| `/login` | Login | Email + password, demo credentials hint |
| `/inventory` | Inventory | Table: item, SKU, category, location, batch, physical, reserved, **available**. Filters: location, category, low-stock. "Adjust stock" modal (Admin/Ops) |
| `/work-orders` | Work Orders | Table: code, location, item, required, available, **shortage**, assignee, status. "Create" (Admin). Status control. "Request transfer" when shortage > 0 |
| `/transfers` | Transfers | Table: code, item, batch, source → destination, qty, status. Actions per status: Dispatch, Receive |
| `/orders` | Customer Orders | Table: code, customer, lines, status. "Create order" → customer + location + line items with live availability. "Reserve" and "Cancel" |

Lift Counterfoil's AppShell, Sidebar, auth store, `ProtectedRoute`, `permissions.ts`, axios client, TanStack Query setup and the entire UI kit. Retarget the sidebar to these five.

**Availability must be visible everywhere a quantity is entered.** The order form shows available-at-location beside each line and blocks submit when the requested quantity exceeds it — while still handling the server's 409, because the client check is a convenience and the server is the authority.

Do not build a dashboard. Do not port the CRM. The brief is explicit.

---

## 12. Seed data

Password for every account: `Password@123`. Put this table in the README.

| Role | Email |
|---|---|
| Admin | `admin@erp.test` |
| Operations | `ops@erp.test` |
| Sales | `sales@erp.test` |

Reuse Counterfoil's seed **generator** (deterministic PRNG, plan-then-write, invariant assertions) — it is genuinely good and the ledger-consistency assertion applies directly. Replace the catalogue.

Seed:
- **3 locations** (`WH-MUM`, `WH-PUN`, `WH-DEL`) — three, so a transfer has a meaningful choice of source.
- **4 categories**, **~20 items**, 1–2 batches each.
- **Inventory rows across all three locations**, deliberately uneven — at least one item plentiful at one location and short at another, so the work-order shortage → transfer flow demos without setup.
- **Opening `IN` movement per inventory row**, so `physicalQty` reconciles to the ledger from row one.
- **2 work orders**: one fully covered, one with a real shortage.
- **1 transfer in each status** (Requested, Dispatched, Received).
- **1 reserved order**, so a non-zero `reservedQty` is visible on the Inventory screen immediately.
- **10 customers.**

Assert before writing: for every inventory row, `physicalQty === last movement's balanceAfter`, and `reservedQty === sum of unreleased reservations`. Fail the seed loudly if not.

---

## 13. Tests

The five mandatory tests, as API-level supertest cases. Counterfoil's `tests/setup.ts` gives you user creation and login already.

| # | Test | Asserts |
|---|---|---|
| 1 | Cannot reserve more than available | 409 `INSUFFICIENT_AVAILABLE`; `reservedQty` unchanged |
| 2 | Cannot transfer more than available | 409; source `physicalQty` unchanged |
| 3 | Destination increases only after receipt | After dispatch: source down, **destination unchanged**. After receipt: destination up |
| 4 | Same transfer cannot be received twice | Second receive → 409; destination increased exactly once |
| 5 | Unauthorized user cannot perform restricted action | Sales creating a work order → 403; Operations reserving → 403 |

**Add a sixth, and lead the demo with it — the concurrency proof:**

```ts
it('does not let two concurrent reservations exceed available stock', async () => {
  // available = 100
  const [a, b] = await Promise.allSettled([
    reserve(orderA, 80),   // fired together, not sequentially
    reserve(orderB, 50),
  ]);

  const ok = [a, b].filter(r => r.status === 'fulfilled' && r.value.status === 201);
  expect(ok).toHaveLength(1);                       // exactly one wins

  const inv = await getInventory(itemId, locationId);
  expect(inv.reservedQty).toBeLessThanOrEqual(inv.physicalQty);   // never oversold
});
```

This is the test that turns *"Both requests must not succeed"* from a claim into evidence. It is worth more than the other five combined in the conversation that follows.

---

## 14. Build order

Estimated **~32 hours** with the platform reused. Each phase ends committed and working.

| Phase | Hours | Deliverable | Commit |
|---|---|---|---|
| 1 | 0–2 | New repo. Platform lift: TS + ESLint, `env.ts`, `app.ts`, health, `AppError`, `errorHandler`, `validate` (**with the Express 5 fix**), auth middleware | `chore: scaffold platform from prior project` |
| 2 | 2–5 | Full Prisma schema, first migration, seed generator + data | `feat: inventory domain schema and seed` |
| 3 | 5–6 | Auth module, 3 roles, login rate limit | `feat: auth and role guards` |
| 4 | 6–10 | Inventory module: read with computed available, adjustments, items/locations/batches | `feat: inventory module` |
| 5 | **10–14** | **Reservation engine (§5) + concurrency test** | `feat: stock reservation with concurrency guard` |
| 6 | 14–18 | Transfers: request, dispatch, receive, idempotency | `feat: internal stock transfers` |
| 7 | 18–21 | Work orders + shortage calculation | `feat: work orders and shortage` |
| 8 | 21–23 | Customer orders: create, reserve, cancel + release | `feat: customer orders and reservations` |
| 9 | 23–25 | All 6 tests green | `test: inventory and transfer invariants` |
| 10 | 25–28 | Frontend: shell lift + 5 screens wired | `feat: operations ui` |
| 11 | 28–30 | Deploy Neon → Render → Vercel; seed production | `chore: production deployment` |
| 12 | 30–32 | README, Mermaid ER diagram, OpenAPI at `/api/docs`, demo video | `docs: readme, er diagram and api docs` |

**Phase 5 before everything else that touches stock.** It is the assignment. If the reservation guard is not provably correct, no amount of UI recovers those 35 marks.

**If time runs short, cut in this order:** batch FEFO allocation (reserve from one batch) → transfer cancel → inventory search/filter polish → work order status transitions.
**Never cut:** the reservation guard, transfer receipt idempotency, RBAC, the six tests, the README.

---

## 15. Designed for live verification

The brief publishes the four changes they may ask for. Each one should already be a small diff. **Do not build them** — build so they are cheap, then say so in the README.

| Change | Why it is already cheap | Work |
|---|---|---|
| **1. Add `DAMAGED`, reducing available** | Availability is computed in one helper | Add `damagedQty` column + one migration; change the helper to `physical − reserved − damaged`; add a `DAMAGE` movement reason | ~30 min |
| **2. Partial transfer receipt** | Transfer already carries `dispatchedQty` / `receivedQty` | Allow `receivedQty < dispatchedQty`, add `PARTIALLY_RECEIVED` status, change the guard to `receivedQty < dispatchedQty` | ~45 min |
| **3. Cancel order, release reservations** | `StockReservation` ledger + `releaseOrder()` | **Already built** in §5.4 | 0 |
| **4. Restrict users to their location** | `User.locationId` exists from day one | Add a `scopeToUserLocation()` helper applied in the inventory/transfer/work-order list queries + a guard on writes | ~1 h |

Put this table in the README under "Extensibility". It tells the reviewer you read the brief and designed against it, which is the whole point of that section.

---

## 16. README outline

1. Overview + the five modules
2. Live links — frontend, backend, `/api/health`, `/api/docs`
3. Test credentials (§12) + Render cold-start note
4. Tech stack and why
5. Architecture — request flow (`route → validate → authenticate → requireRole → controller → service → Prisma`), layering rules, folder map
6. **Database schema — Mermaid ER diagram** + the §3.3 design notes
7. **Business rules** — availability formula, reservation concurrency (§5), transfer in-transit rule, receipt idempotency, shortage calculation
8. Local setup
9. Environment variables — table of every var with purpose and example
10. Deployment — step by step, and how to redeploy
11. API documentation — link to `/api/docs`, envelope, error codes
12. How to run the tests + what each of the six proves
13. **Extensibility** — the §15 table
14. Assumptions — single tenant, INR, integer quantities, one UOM per item, no partial dispatch, no costing/valuation
15. Known limitations — no refresh-token rotation, token in `localStorage`, no frontend tests, no multi-tenancy, cold start on free tier
16. Demo video link

---

## 17. Acceptance checklist

**Auth & roles** — ☐ 3 roles log in ☐ missing/invalid token → 401 ☐ wrong role → 403 ☐ UI hides unavailable actions

**Inventory** — ☐ item, category, location, batch, physical, reserved, available all present ☐ available = physical − reserved everywhere ☐ negative stock impossible ☐ invalid quantity rejected ☐ every adjustment writes a movement ☐ `physicalQty` reconciles to the ledger

**Work orders** — ☐ all 6 fields ☐ Admin-only creation ☐ 3 statuses, forward-only ☐ shortage computed correctly ☐ shortage links to a transfer

**Transfers** — ☐ all 6 fields ☐ 3 statuses ☐ dispatch reduces source ☐ **destination unchanged before receipt** ☐ receipt increases destination ☐ **second receipt rejected** ☐ cannot dispatch more than available

**Customer orders** — ☐ Sales creates ☐ reservation increases `reservedQty` and decreases available ☐ cannot reserve beyond available ☐ **two concurrent reservations: exactly one succeeds** ☐ cancel releases

**Delivery** — ☐ repo with real commit history ☐ README complete ☐ ER diagram ☐ OpenAPI/Postman ☐ 6 tests green ☐ demo video showing `Login → Inventory → Work Order → Transfer → Order Reservation` ☐ live URLs with credentials for all three roles

---

## 18. One thing to rehearse before the interview

The brief is explicit: *"If you cannot modify or explain your own application, the submission will not qualify."*

Be able to answer these three without looking:

1. **"Show me where two users are stopped from over-reserving."** → §5.3. Say: `SELECT ... FOR UPDATE` locks the candidate rows; under READ COMMITTED the second transaction blocks at the SELECT and re-reads after the first commits, so it sees the reduced availability, not the stale number.
2. **"Why can't a transfer be received twice?"** → §6.2. Say: the status is claimed with a conditional `updateMany` guarded on `status = 'DISPATCHED'`. Zero rows matched means someone already received it, and it 409s before any stock moves.
3. **"Where does available quantity come from?"** → One helper, `physical − reserved`, never stored, because three numbers that must agree will eventually disagree if you persist all three.

If you can draw the `Item × Location × Batch` grain on a whiteboard and explain why `batchId` is `NOT NULL`, you are in good shape.

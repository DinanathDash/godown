# Mini ERP + CRM Operations Portal — Implementation Plan

**Audience:** an LLM or developer executing this build end-to-end.
**Source:** "Full Stack Developer Case Study — Mini ERP + CRM Operations Portal", 48-hour deadline.

---

## 0. Rules for the implementer

1. **The stack decisions in §1 are locked.** Do not substitute libraries or re-litigate choices. They are chosen for 48-hour delivery on free infrastructure.
2. **Build in the order given in §12.** Each phase ends in a working, committed state.
3. **Never invent scope.** Only the four required modules plus the listed bonuses. Invoices exist only as a PDF rendering of a confirmed challan (bonus).
4. **Every API response shape in §6 and §7 is a contract.** The frontend is written against it.
5. **Commit continuously** with Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). The reviewer inspects commit history — one giant commit is a fail signal.
6. **No secrets in git.** `.env` is gitignored; `.env.example` is committed.
7. If something is cut for time, record it in README → "Known limitations". A documented gap scores better than a silent one.

---

## 1. Locked technical decisions

| Layer         | Choice                                           | Reason                                            |
| ------------- | ------------------------------------------------ | ------------------------------------------------- |
| Runtime       | Node.js 20 LTS                                   | Stable, supported on all free hosts               |
| Language      | TypeScript 5.x, `strict: true`                   | Required by brief                                 |
| API framework | Express 4                                        | Faster to ship than NestJS at this scope          |
| ORM           | Prisma 5                                         | Type-safe, migrations + seed in one tool          |
| Database      | PostgreSQL 16 (Neon free tier)                   | Required by brief; Neon has no sleep on the DB    |
| Validation    | Zod                                              | Single schema reused for types and runtime checks |
| Auth          | JWT (HS256), bcrypt hashing                      | Explicitly allowed by brief                       |
| Frontend      | Next.js + TypeScript                             | Full-stack framework with React Server Components |
| Routing       | Next.js App Router                               | Built into Next.js                                |
| Server state  | TanStack Query v5                                | Caching, pagination, invalidation for free        |
| Forms         | react-hook-form + zod resolver                   | Shares validation shapes with backend             |
| Styling       | Inline Tailwind CSS                              | Dense admin UI without writing a design system    |
| Components    | shadcn/ui                                        | Pre-built accessible components                   |
| HTTP client   | axios (single configured instance)               | Interceptors for auth + error normalisation       |
| Notifications | sonner                                           | —                                                 |
| Icons         | lucide-react or simple-icons                     | —                                                 |
| Tests         | vitest + supertest (backend only)                | Prove the stock logic; skip frontend tests        |
| Hosting       | Frontend → Vercel · Backend → Render · DB → Neon | Free, no card required                            |

**Repository:** single repo, two folders.

```
erp-crm-portal/
├── backend/
├── frontend/
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   └── postman_collection.json
├── .github/workflows/ci.yml    # bonus
└── README.md
```

---

## 2. Domain model

### 2.1 Prisma schema (`backend/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role           { ADMIN SALES WAREHOUSE ACCOUNTS }
enum CustomerType   { RETAIL WHOLESALE DISTRIBUTOR }
enum CustomerStatus { LEAD ACTIVE INACTIVE }
enum MovementType   { IN OUT }
enum ChallanStatus  { DRAFT CONFIRMED CANCELLED }

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  customers        Customer[]
  customerNotes    CustomerNote[]
  stockMovements   StockMovement[]
  challansCreated  Challan[]       @relation("ChallanCreatedBy")

  @@map("users")
}

model Customer {
  id           String         @id @default(uuid())
  name         String
  mobile       String
  email        String?
  businessName String?
  gstNumber    String?
  type         CustomerType   @default(RETAIL)
  address      String?
  status       CustomerStatus @default(LEAD)
  followUpDate DateTime?
  notes        String?
  createdById  String
  deletedAt    DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  createdBy     User           @relation(fields: [createdById], references: [id])
  followUpNotes CustomerNote[]
  challans      Challan[]

  @@index([status])
  @@index([mobile])
  @@index([name])
  @@index([followUpDate])
  @@map("customers")
}

model CustomerNote {
  id           String   @id @default(uuid())
  customerId   String
  note         String
  followUpDate DateTime?
  createdById  String
  createdAt    DateTime @default(now())

  customer  Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdBy User     @relation(fields: [createdById], references: [id])

  @@index([customerId, createdAt])
  @@map("customer_notes")
}

model Product {
  id            String    @id @default(uuid())
  name          String
  sku           String    @unique
  category      String?
  unitPrice     Decimal   @db.Decimal(12, 2)
  currentStock  Int       @default(0)
  minStockAlert Int       @default(0)
  location      String?
  imageUrl      String?
  isActive      Boolean   @default(true)
  deletedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  stockMovements StockMovement[]
  challanItems   ChallanItem[]

  @@index([name])
  @@index([category])
  @@map("products")
}

model StockMovement {
  id            String       @id @default(uuid())
  productId     String
  quantity      Int          // always positive; direction is in `type`
  type          MovementType
  reason        String
  referenceType String?      // "CHALLAN" | "MANUAL"
  referenceId   String?
  balanceAfter  Int
  createdById   String
  createdAt     DateTime     @default(now())

  product   Product @relation(fields: [productId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id])

  @@index([productId, createdAt])
  @@index([type])
  @@map("stock_movements")
}

model Challan {
  id               String        @id @default(uuid())
  challanNumber    String        @unique
  customerId       String
  customerSnapshot Json          // frozen copy of customer at creation time
  status           ChallanStatus @default(DRAFT)
  totalQuantity    Int           @default(0)
  totalAmount      Decimal       @default(0) @db.Decimal(14, 2)
  notes            String?
  createdById      String
  confirmedAt      DateTime?
  cancelledAt      DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  customer  Customer      @relation(fields: [customerId], references: [id])
  createdBy User          @relation("ChallanCreatedBy", fields: [createdById], references: [id])
  items     ChallanItem[]

  @@index([status, createdAt])
  @@index([customerId])
  @@map("challans")
}

model ChallanItem {
  id          String  @id @default(uuid())
  challanId   String
  productId   String
  productName String  // snapshot
  sku         String  // snapshot
  category    String? // snapshot
  unitPrice   Decimal @db.Decimal(12, 2) // snapshot
  quantity    Int
  lineTotal   Decimal @db.Decimal(14, 2)

  challan Challan @relation(fields: [challanId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@index([challanId])
  @@map("challan_items")
}

model Counter {
  key   String @id
  value Int    @default(0)

  @@map("counters")
}
```

### 2.2 Data rules

- **Money** is `Decimal(12,2)` in the DB and is serialised to JSON as a **string** (`"1250.00"`). The frontend formats with `Intl.NumberFormat`. Never use JS floats for money.
- **Soft delete**: `Customer` and `Product` use `deletedAt`. Every list/detail query filters `deletedAt: null`. SKU stays reserved after soft delete (unique constraint stands).
- **Mobile is not DB-unique** (soft-deleted rows would block reuse). The service layer checks for a non-deleted duplicate and returns `409 DUPLICATE_MOBILE`.
- **Snapshots**: `Challan.customerSnapshot` stores `{ name, mobile, email, businessName, gstNumber, type, address }`. `ChallanItem` stores name, sku, category and unitPrice. Editing a product later must never change a historic challan.
- **Stock is only ever mutated inside a transaction that also writes a `StockMovement` row.** No exceptions — the movement log must reconcile with `currentStock`.

---

## 3. Roles and permissions

| Resource / action                | Admin | Sales | Warehouse | Accounts |
| -------------------------------- | :---: | :---: | :-------: | :------: |
| Users: list/create               |  ✅   |  ❌   |    ❌     |    ❌    |
| Customers: read                  |  ✅   |  ✅   |    ❌     |    ✅    |
| Customers: create/update         |  ✅   |  ✅   |    ❌     |    ❌    |
| Customers: delete                |  ✅   |  ❌   |    ❌     |    ❌    |
| Follow-up notes: add             |  ✅   |  ✅   |    ❌     |    ❌    |
| Products: read                   |  ✅   |  ✅   |    ✅     |    ✅    |
| Products: create/update          |  ✅   |  ❌   |    ✅     |    ❌    |
| Products: delete                 |  ✅   |  ❌   |    ❌     |    ❌    |
| Stock adjustment (manual IN/OUT) |  ✅   |  ❌   |    ✅     |    ❌    |
| Stock movement log: read         |  ✅   |  ✅   |    ✅     |    ✅    |
| Challans: read                   |  ✅   |  ✅   |    ✅     |    ✅    |
| Challans: create / edit draft    |  ✅   |  ✅   |    ❌     |    ❌    |
| Challans: confirm                |  ✅   |  ✅   |    ✅     |    ❌    |
| Challans: cancel                 |  ✅   |  ❌   |    ❌     |    ❌    |
| Challan PDF export               |  ✅   |  ✅   |    ❌     |    ✅    |
| Dashboard                        |  ✅   |  ✅   |    ✅     |    ✅    |

Enforced by `requireRole(...roles)` middleware on every route. The frontend mirrors this matrix in a single `permissions.ts` map to hide unavailable actions — but the **server is the source of truth**.

---

## 4. Backend structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── config/env.ts              # zod-validated process.env, fail fast on boot
│   ├── lib/prisma.ts              # singleton PrismaClient
│   ├── lib/jwt.ts                 # sign / verify
│   ├── lib/password.ts            # bcrypt hash / compare
│   ├── lib/logger.ts              # pino
│   ├── middleware/
│   │   ├── authenticate.ts        # verifies JWT → req.user
│   │   ├── requireRole.ts         # RBAC guard
│   │   ├── validate.ts            # zod body/query/params validator
│   │   ├── notFound.ts
│   │   └── errorHandler.ts        # single exit point for all errors
│   ├── modules/
│   │   ├── auth/       { routes, controller, service, schema }.ts
│   │   ├── customers/  { routes, controller, service, schema }.ts
│   │   ├── products/   { routes, controller, service, schema }.ts
│   │   ├── challans/   { routes, controller, service, schema }.ts
│   │   └── dashboard/  { routes, controller, service }.ts
│   ├── utils/
│   │   ├── AppError.ts
│   │   ├── pagination.ts
│   │   ├── challanNumber.ts
│   │   └── serialize.ts           # Decimal → string helpers
│   ├── routes.ts                  # mounts all module routers under /api
│   ├── app.ts                     # express app (exported for tests)
│   └── server.ts                  # listen()
└── tests/
    ├── auth.test.ts
    ├── challan-stock.test.ts
    └── rbac.test.ts
```

**Layering rule:** `controller` handles HTTP only (parse → call service → send). `service` owns business logic and Prisma access. No Prisma calls in controllers, no `req`/`res` in services.

**Middleware order in `app.ts`:**
`helmet()` → `cors({ origin: env.CORS_ORIGINS.split(','), credentials: false })` → `express.json({ limit: '1mb' })` → request-id + pino-http → `rateLimit` on `/api/auth/login` (10 req / 15 min / IP) → `/api/health` → `/api` routes → `notFound` → `errorHandler`.

---

## 5. Cross-cutting conventions

### 5.1 Response envelope

Single resource (200/201):

```json
{ "id": "…", "name": "…" }
```

List (200):

```json
{
  "data": [ … ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

Error (any 4xx/5xx):

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for 2 product(s)",
    "details": [
      { "productId": "…", "sku": "SKU-001", "requested": 10, "available": 4 }
    ]
  }
}
```

### 5.2 Status codes

| Code | Used for                                                                               |
| ---- | -------------------------------------------------------------------------------------- |
| 200  | Successful read / update                                                               |
| 201  | Resource created                                                                       |
| 204  | Successful delete                                                                      |
| 400  | `VALIDATION_ERROR` — malformed body, query or params                                   |
| 401  | `UNAUTHENTICATED` — missing/expired/invalid token                                      |
| 403  | `FORBIDDEN` — authenticated but role not permitted                                     |
| 404  | `NOT_FOUND`                                                                            |
| 409  | `DUPLICATE_SKU`, `DUPLICATE_MOBILE`, `INSUFFICIENT_STOCK`, `INVALID_STATUS_TRANSITION` |
| 429  | `RATE_LIMITED` (login only)                                                            |
| 500  | `INTERNAL_ERROR` — never leaks stack traces in production                              |

### 5.3 `AppError` and the error handler

```ts
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
```

`errorHandler` maps: `ZodError` → 400 with flattened field issues; `AppError` → its own status; Prisma `P2002` → 409; Prisma `P2025` → 404; anything else → 500 with the error logged server-side and a generic client message.

### 5.4 Pagination, search, sorting

Every list endpoint accepts `page` (default 1), `limit` (default 20, max 100), `search`, `sortBy`, `sortOrder` (`asc|desc`, default `desc` on `createdAt`). `sortBy` is validated against an allowlist per module. Search uses Prisma `contains` with `mode: 'insensitive'` across the module's named fields.

### 5.5 Auth

- `POST /api/auth/login` returns a JWT signed with `JWT_SECRET`, payload `{ sub, role, email }`, expiry `JWT_EXPIRES_IN` (default `12h`).
- Client sends `Authorization: Bearer <token>`; token is kept in `localStorage`.
- **Documented tradeoff:** no refresh-token rotation and `localStorage` storage are accepted for assignment scope; both are listed in README → Known limitations, with httpOnly-cookie refresh rotation named as the production fix.
- Passwords: bcrypt, 10 rounds. Password hashes are never selected into any API response.

---

## 6. API reference

Base path `/api`. All routes except `/health` and `/auth/login` require a bearer token.

### Auth

| Method | Path          | Roles  | Notes                                           |
| ------ | ------------- | ------ | ----------------------------------------------- |
| POST   | `/auth/login` | public | `{ email, password }` → `{ accessToken, user }` |
| GET    | `/auth/me`    | any    | Current user profile                            |

### Customers

| Method | Path                        | Roles                  | Notes                                                                                              |
| ------ | --------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/customers`                | Admin, Sales, Accounts | `?page&limit&search&status&type&sortBy&sortOrder`; search covers name, mobile, businessName, email |
| POST   | `/customers`                | Admin, Sales           | 201                                                                                                |
| GET    | `/customers/:id`            | Admin, Sales, Accounts | Includes last 20 follow-up notes and last 5 challans                                               |
| PATCH  | `/customers/:id`            | Admin, Sales           | Partial update                                                                                     |
| DELETE | `/customers/:id`            | Admin                  | Soft delete, 204                                                                                   |
| GET    | `/customers/:id/notes`      | Admin, Sales, Accounts | Paginated                                                                                          |
| POST   | `/customers/:id/notes`      | Admin, Sales           | `{ note, followUpDate? }`; if `followUpDate` given, also updates `customer.followUpDate`           |
| GET    | `/customers/follow-ups/due` | Admin, Sales           | `?days=7` — follow-ups due within N days                                                           |

### Products & stock

| Method | Path                              | Roles            | Notes                                                                       |
| ------ | --------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| GET    | `/products`                       | any              | `?page&limit&search&category&lowStock=true`; search covers name, sku        |
| POST   | `/products`                       | Admin, Warehouse | Optional `openingStock` creates an `IN` movement in the same transaction    |
| GET    | `/products/:id`                   | any              | Includes last 10 movements                                                  |
| PATCH  | `/products/:id`                   | Admin, Warehouse | **`currentStock` is not editable here** — use the adjustment endpoint       |
| DELETE | `/products/:id`                   | Admin            | Soft delete; 409 if referenced by a DRAFT challan                           |
| POST   | `/products/:id/stock-adjustments` | Admin, Warehouse | `{ type: "IN"\|"OUT", quantity, reason }` → updates stock + writes movement |
| GET    | `/products/low-stock`             | any              | `currentStock <= minStockAlert`                                             |
| GET    | `/stock-movements`                | any              | `?productId&type&from&to&page&limit`                                        |

### Challans

| Method | Path                    | Roles                   | Notes                                                                                   |
| ------ | ----------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| GET    | `/challans`             | any                     | `?page&limit&search&status&customerId&from&to`; search on challanNumber + customer name |
| POST   | `/challans`             | Admin, Sales            | Body below; `status: "DRAFT"` or `"CONFIRMED"`                                          |
| GET    | `/challans/:id`         | any                     | Full items + snapshots                                                                  |
| PATCH  | `/challans/:id`         | Admin, Sales            | **DRAFT only**; replaces the item set; 409 otherwise                                    |
| POST   | `/challans/:id/confirm` | Admin, Sales, Warehouse | DRAFT → CONFIRMED, deducts stock                                                        |
| POST   | `/challans/:id/cancel`  | Admin                   | DRAFT → CANCELLED; CONFIRMED → CANCELLED restores stock via `IN` movements              |
| GET    | `/challans/:id/pdf`     | Admin, Sales, Accounts  | Bonus                                                                                   |

### Dashboard

| Method | Path                 | Roles | Notes                                                                                                                  |
| ------ | -------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/dashboard/summary` | any   | Counts: customers by status, products, low-stock count, challans by status, today's challans, follow-ups due this week |

### Health

`GET /api/health` → `{ "status": "ok", "uptime": 1234 }` (unauthenticated, used by Render).

### Key payloads

**POST /api/challans**

```json
{
  "customerId": "uuid",
  "status": "CONFIRMED",
  "notes": "Deliver before 6 PM",
  "items": [
    { "productId": "uuid", "quantity": 5 },
    { "productId": "uuid", "quantity": 2, "unitPrice": "199.00" }
  ]
}
```

`unitPrice` is optional; when omitted the current product price is snapshotted. Duplicate `productId` entries are merged (quantities summed) before processing.

**201 response**

```json
{
  "id": "uuid",
  "challanNumber": "CHL-2026-00042",
  "status": "CONFIRMED",
  "customer": {
    "id": "uuid",
    "name": "Rakesh Traders",
    "mobile": "9876543210"
  },
  "customerSnapshot": {
    "name": "Rakesh Traders",
    "gstNumber": "27AAAPA1234A1Z5",
    "…": "…"
  },
  "items": [
    {
      "productId": "uuid",
      "productName": "Steel Bolt 10mm",
      "sku": "BLT-010",
      "unitPrice": "12.50",
      "quantity": 5,
      "lineTotal": "62.50"
    }
  ],
  "totalQuantity": 5,
  "totalAmount": "62.50",
  "createdBy": { "id": "uuid", "name": "Sales User" },
  "confirmedAt": "2026-09-01T09:12:00.000Z",
  "createdAt": "2026-09-01T09:12:00.000Z"
}
```

**409 insufficient stock**

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for 1 product(s)",
    "details": [
      {
        "productId": "uuid",
        "sku": "BLT-010",
        "productName": "Steel Bolt 10mm",
        "requested": 500,
        "available": 42
      }
    ]
  }
}
```

---

## 7. Core business logic

### 7.1 Challan number generation

Format `CHL-{YYYY}-{00001}`, sequence per calendar year, generated **inside the challan transaction** so numbers are gapless and race-free.

```ts
export async function nextChallanNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `challan:${year}`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO counters (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
    RETURNING value`;
  return `CHL-${year}-${String(rows[0].value).padStart(5, "0")}`;
}
```

### 7.2 Confirming a challan (the critical path)

Requirements from the brief: confirming reduces stock; stock must never go negative; insufficient stock returns a proper error; product data is snapshotted.

```ts
async function confirmChallanTx(
  tx: Prisma.TransactionClient,
  challanId: string,
  userId: string,
) {
  const challan = await tx.challan.findUnique({
    where: { id: challanId },
    include: { items: true },
  });
  if (!challan) throw new AppError(404, "NOT_FOUND", "Challan not found");
  if (challan.status !== "DRAFT")
    throw new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot confirm a challan with status ${challan.status}`,
    );

  // Pass 1 — aggregate check so the client gets every shortfall at once.
  const products = await tx.product.findMany({
    where: { id: { in: challan.items.map((i) => i.productId) } },
    select: { id: true, sku: true, name: true, currentStock: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const shortfalls = challan.items
    .filter((i) => (byId.get(i.productId)?.currentStock ?? 0) < i.quantity)
    .map((i) => ({
      productId: i.productId,
      sku: i.sku,
      productName: i.productName,
      requested: i.quantity,
      available: byId.get(i.productId)?.currentStock ?? 0,
    }));
  if (shortfalls.length)
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Insufficient stock for ${shortfalls.length} product(s)`,
      shortfalls,
    );

  // Pass 2 — conditional decrement. `count === 0` means another transaction
  // consumed the stock between the check and the write. This is the guard that
  // actually makes negative stock impossible.
  for (const item of challan.items) {
    const res = await tx.product.updateMany({
      where: { id: item.productId, currentStock: { gte: item.quantity } },
      data: { currentStock: { decrement: item.quantity } },
    });
    if (res.count === 0)
      throw new AppError(
        409,
        "INSUFFICIENT_STOCK",
        "Stock changed during confirmation, please retry",
        [
          {
            productId: item.productId,
            sku: item.sku,
            requested: item.quantity,
          },
        ],
      );

    const after = await tx.product.findUniqueOrThrow({
      where: { id: item.productId },
      select: { currentStock: true },
    });
    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        quantity: item.quantity,
        type: "OUT",
        reason: `Challan ${challan.challanNumber} confirmed`,
        referenceType: "CHALLAN",
        referenceId: challan.id,
        balanceAfter: after.currentStock,
        createdById: userId,
      },
    });
  }

  return tx.challan.update({
    where: { id: challanId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
    include: { items: true, customer: true, createdBy: true },
  });
}
```

Wrap with `prisma.$transaction(async tx => …, { timeout: 15000 })`. Any thrown error rolls back stock, movements and status together.

### 7.3 Other invariants

- **Create with `status: "CONFIRMED"`** → within one transaction: create the DRAFT (number, snapshots, totals), then call `confirmChallanTx`. Never two round trips.
- **Editing a challan** is only allowed in DRAFT. `PATCH` deletes and recreates `ChallanItem` rows and recomputes totals. Confirmed challans are immutable.
- **Cancelling a CONFIRMED challan** restores stock: for each item, `increment` stock and write an `IN` movement with reason `Challan {number} cancelled`. Admin only.
- **Manual stock adjustment**: `OUT` uses the same conditional-decrement guard and returns `409 INSUFFICIENT_STOCK`; `IN` increments. Both write a movement with `balanceAfter`.
- **Totals** are computed server-side only. Values sent by the client for `lineTotal`/`totalAmount` are ignored.

---

## 8. Validation rules

Defined once per module in `schema.ts` with Zod; the `validate` middleware parses `body`/`query`/`params` and replaces them with the parsed values.

| Field                       | Rule                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `email`                     | valid email, lowercased, trimmed                                                    |
| `password`                  | min 8 chars on create; login only checks non-empty                                  |
| `customer.name`             | 2–120 chars, required                                                               |
| `customer.mobile`           | `/^[0-9]{10}$/` (10-digit Indian mobile); required                                  |
| `customer.gstNumber`        | optional, `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/`, uppercased |
| `customer.type` / `status`  | enum                                                                                |
| `customer.followUpDate`     | ISO date string, coerced to Date                                                    |
| `product.name`              | 2–150 chars                                                                         |
| `product.sku`               | 2–50 chars, `/^[A-Za-z0-9-_]+$/`, uppercased, unique                                |
| `product.unitPrice`         | decimal string or number ≥ 0, max 2 dp                                              |
| `product.minStockAlert`     | integer ≥ 0                                                                         |
| `openingStock` / `quantity` | integer ≥ 1 (adjustments), ≥ 0 (opening)                                            |
| `challan.items`             | array, min 1 item                                                                   |
| `challan.items[].quantity`  | integer ≥ 1                                                                         |
| `page` / `limit`            | coerced int, `page ≥ 1`, `1 ≤ limit ≤ 100`                                          |

Trim all strings; convert empty optional strings to `null` before persisting.

---

## 9. Frontend

### 9.1 Structure

```text
frontend/src/
├── app/                   # Next.js App Router
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/page.tsx
│   ├── (dashboard)/customers/page.tsx
│   ├── (dashboard)/customers/[id]/page.tsx
│   ├── (dashboard)/products/page.tsx
│   ├── (dashboard)/products/[id]/page.tsx
│   ├── (dashboard)/challans/page.tsx
│   ├── (dashboard)/challans/new/page.tsx
│   ├── (dashboard)/challans/[id]/page.tsx
│   └── layout.tsx
├── api/
│   ├── client.ts          # axios instance, baseURL from NEXT_PUBLIC_API_URL
│   ├── auth.ts  customers.ts  products.ts  challans.ts  dashboard.ts
├── auth/
│   ├── AuthProvider.tsx   # token + user in context, hydrated from localStorage
│   ├── ProtectedRoute.tsx # redirects to /login
│   ├── RoleGate.tsx       # renders children only for allowed roles
│   └── permissions.ts     # mirror of §3 matrix
├── components/
│   ├── layout/{AppShell,Sidebar,Topbar}.tsx
│   └── ui/{button,input,select,dialog,table,pagination,badge,skeleton}.tsx # (shadcn/ui)
├── features/
│   ├── dashboard/DashboardPage.tsx
│   ├── customers/{CustomerListPage,CustomerFormModal,CustomerDetailPage,FollowUpNoteForm}.tsx
│   ├── products/{ProductListPage,ProductFormModal,StockAdjustModal,ProductDetailPage}.tsx
│   └── challans/{ChallanListPage,ChallanCreatePage,ChallanDetailPage,ProductPicker}.tsx
├── hooks/useDebounce.ts
├── lib/{format.ts,queryClient.ts,utils.ts}
└── types/api.ts           # hand-written mirrors of the §6 contracts
```

### 9.2 Cross-cutting behaviour

- `client.ts` request interceptor attaches the bearer token; response interceptor maps errors to `{ code, message, details }` and, on 401, clears auth state and redirects to `/login`.
- All server reads go through TanStack Query with keys like `['customers', { page, search, status }]`. Mutations invalidate the affected key prefix.
- Every list page: debounced (350 ms) search box, filter selects, server-side pagination, loading skeleton, empty state, error state with retry.
- Errors surface as toasts using `error.message`; `INSUFFICIENT_STOCK` additionally renders `details` as a per-line table inside the challan form.
- Forms use react-hook-form + zod resolvers that mirror §8, so client and server reject the same input.
- `RoleGate` hides actions the user cannot perform. A 403 from the API still shows a clear toast.

### 9.3 Pages

| Route            | Page            | Contents                                                                                                                                          |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`         | Login           | Email + password, error message, demo-credentials hint                                                                                            |
| `/`              | Dashboard       | Stat tiles from `/dashboard/summary`, low-stock table, follow-ups due this week                                                                   |
| `/customers`     | Customer list   | Table: name, business, mobile, type, status badge, follow-up date, actions. Filters: status, type. "Add customer" opens a modal                   |
| `/customers/:id` | Customer detail | Profile card, editable via modal, follow-up notes timeline with add form, recent challans                                                         |
| `/products`      | Product list    | Table: SKU, name, category, price, stock (red when ≤ min alert), location, actions. `lowStock` toggle. Add/Edit modal, "Adjust stock" modal       |
| `/products/:id`  | Product detail  | Product card + paginated movement log (date, type, qty, balance after, reason, user)                                                              |
| `/challans`      | Challan list    | Table: number, customer, date, items, total qty, total amount, status badge. Filters: status, date range                                          |
| `/challans/new`  | Create challan  | Customer combobox, product picker rows (product, available stock, qty, unit price, line total), running totals, "Save draft" / "Save and confirm" |
| `/challans/:id`  | Challan detail  | Read-only snapshot view, status badge, Confirm / Cancel / Download PDF buttons per role and status                                                |

### 9.4 Visual direction

This is an operations tool used all day by warehouse and accounts staff, so it optimises for density and scanning, not marketing polish. Keep it disciplined and consistent rather than decorative.

- **Palette:** `--surface #FFFFFF`, `--canvas #F5F6F8`, `--ink #14181F`, `--muted #5B6472`, `--line #E2E5EA`, `--accent #1F5FA9` (single accent, used only for primary actions and active nav). Status colours: draft `#8A93A2`, confirmed `#18794E`, cancelled `#B42318`, low-stock warning `#B54708`.
- **Type:** one family — Inter (or system sans) at 13px base for tables, 14px for forms, 20/16px for headings. Tabular numerals (`font-variant-numeric: tabular-nums`) on all quantity and money columns so figures align.
- **Layout:** fixed 240px left sidebar with the five sections, sticky topbar showing user name and role, content max-width 1280px. Tables are full-bleed within the content area with sticky headers; right-align numeric columns.
- **Restraint:** one accent colour, one border radius (6px), one shadow (used only on modals and dropdowns). No gradients, no card-in-card nesting, no decorative icons in table cells.
- **Quality floor:** responsive down to 375px (tables become stacked rows below `md`), visible keyboard focus rings, `aria-label`s on icon-only buttons, destructive actions behind a confirm dialog, `prefers-reduced-motion` respected.
- **Copy:** buttons name the action and the toast repeats it — "Confirm challan" → "Challan confirmed". Empty states say what to do next ("No customers yet. Add your first customer."). Errors say what happened and how to fix it.

---

## 10. Environment and configuration

### Backend `.env.example`

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/erp?schema=public
JWT_SECRET=replace-with-64-char-random-string
JWT_EXPIRES_IN=12h
CORS_ORIGINS=http://localhost:3000
BCRYPT_ROUNDS=10
LOG_LEVEL=info
# bonus (S3 image upload)
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### Frontend `.env.example`

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

`src/config/env.ts` parses `process.env` with Zod at boot and throws with a readable message if anything is missing — the app must never start half-configured. Nothing reads `process.env` directly anywhere else.

---

## 11. Deployment

### 11.1 Database — Neon

1. Create a project, copy the pooled connection string.
2. Set `DATABASE_URL` (append `?sslmode=require`).
3. Migrations are applied by the backend start command, not manually.

### 11.2 Backend — Render Web Service

- Root directory: `backend`
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/server.js`
- Health check path: `/api/health`
- Env vars: everything in the backend `.env.example` except the AWS block, with `NODE_ENV=production` and `CORS_ORIGINS` set to the Vercel URL.
- Seeding: run `npx prisma db seed` once from the Render shell (or a temporary `SEED_ON_BOOT=true` guard, removed after first deploy).
- **Free tier sleeps after 15 minutes of inactivity.** Note the ~50 s cold start in the README and in the submission email.

### 11.3 Frontend — Vercel

- Root directory: `frontend`, framework preset Next.js.
- Build: `npm run build`, output `.next`.
- Env var: `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com/api`.

### 11.4 Order of operations

Neon → backend on Render (verify `/api/health` and a login via curl) → frontend on Vercel → set `CORS_ORIGINS` to the real Vercel domain → redeploy backend → smoke-test all four logins in the browser.

### 11.5 Local setup (documented in README)

```bash
git clone <repo> && cd erp-crm-portal
# Backend
cd backend && cp .env.example .env && npm install
npx prisma migrate dev && npx prisma db seed
npm run dev                       # http://localhost:4000
cd ../frontend && cp .env.example .env && npm install
npm run dev                       # http://localhost:3000

---

## 12. Build order (48 hours)

| Phase | Hours | Deliverable                                                                                                   | Commit                               |
| ----- | ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1     | 0–2   | Repo, backend TS + ESLint + Prettier scaffold, `env.ts`, `app.ts`, `/api/health`, error handler, `AppError`   | `chore: scaffold backend`            |
| 2     | 2–5   | Full Prisma schema, first migration, seed script (4 users, 8 products, 6 customers, 2 challans)               | `feat: database schema and seed`     |
| 3     | 5–7   | Auth module: login, `/auth/me`, JWT + bcrypt, `authenticate`, `requireRole`, login rate limit                 | `feat: jwt auth and rbac`            |
| 4     | 7–11  | Customers module: CRUD, soft delete, notes, follow-ups-due, pagination/search/filter                          | `feat: customer crm module`          |
| 5     | 11–15 | Products module: CRUD, stock adjustments, movement log, low-stock                                             | `feat: product and inventory module` |
| 6     | 15–21 | Challans: create draft/confirmed, confirm, cancel, edit draft, number generator, snapshots, stock transaction | `feat: sales challan module`         |
| 7     | 21–23 | Vitest + supertest: login, RBAC 403, stock deduction, insufficient stock 409, no-negative-stock               | `test: challan stock invariants`     |
| 8     | 23–25 | Frontend scaffold: Next.js, inline Tailwind, shadcn/ui, axios client, AuthProvider, AppShell, login page      | `feat: frontend shell and auth`      |
| 9     | 25–29 | Customer list + detail + forms + notes                                                                        | `feat: customer ui`                  |
| 10    | 29–33 | Product list + forms + stock adjust + movement log                                                            | `feat: product ui`                   |
| 11    | 33–38 | Challan list, create page with product picker, detail page, confirm/cancel                                    | `feat: challan ui`                   |
| 12    | 38–40 | Dashboard, empty/loading/error states, responsive pass, a11y pass                                             | `feat: dashboard and ui polish`      |
| 13    | 40–44 | Deploy DB → backend → frontend; fix CORS and env issues; seed production                                      | `chore: production deployment`       |
| 14    | 44–47 | README, `docs/architecture.md`, `docs/deployment.md`, Postman collection, screen recording                    | `docs: readme and api documentation` |
| 15    | 47–48 | Full smoke test against live URLs for all four roles; final commit                                            | `chore: final polish`                |

**If time runs short, cut in this order:** dashboard charts → challan PDF → product detail page → tests beyond the stock cases. Never cut: the confirm-stock transaction, RBAC, validation, README, deployment.

---

## 13. Seed data

Password for every seeded account: `Password@123`. Put this table in the README under "Test credentials".

| Role      | Email                |
| --------- | -------------------- |
| Admin     | `aarti.admin@counterfoil.test`     |
| Sales     | `nikhil.sales@counterfoil.test`     |
| Warehouse | `suresh.warehouse@counterfoil.test` |
| Accounts  | `meera.accounts@counterfoil.test`  |

Also seed: 8 products across 3 categories (two of them below `minStockAlert` so the low-stock view is not empty), 6 customers spanning all three types and all three statuses (two with follow-up dates in the next 7 days), 1 CONFIRMED challan with its `OUT` movements and 1 DRAFT challan. Make the seed idempotent with `upsert` on `email`/`sku` so it can be re-run safely.

---

## 14. Testing and API documentation

**Automated (backend, vitest + supertest, ~10 tests):**

1. Login with valid credentials returns a token; invalid returns 401.
2. Request without a token returns 401; Warehouse creating a customer returns 403.
3. Confirming a challan reduces stock by exactly the ordered quantity and writes one `OUT` movement per line with the correct `balanceAfter`.
4. Confirming with quantity greater than stock returns 409 `INSUFFICIENT_STOCK` with `details`, and leaves stock and status unchanged.
5. Confirming an already-CONFIRMED challan returns 409 `INVALID_STATUS_TRANSITION`.
6. Cancelling a CONFIRMED challan restores stock.
7. Duplicate SKU returns 409.
8. Invalid mobile returns 400 with the field name in `details`.

**Postman collection** (`docs/postman_collection.json`): environment variables `baseUrl` and `token`; folders Auth, Customers, Products, Stock, Challans, Dashboard; a test script on login that stores `accessToken` into `{{token}}`; every folder covering the happy path plus one error case. Export the environment file too.

**Screen recording** (5–7 min, required if not deploying, recommended either way): login as each role → create a customer → add a follow-up note → create a product → adjust stock → create a challan and confirm it → show stock reduced and the movement log → attempt a challan that exceeds stock and show the error → show a Sales user blocked from a Warehouse action.

---

## 15. Bonus items (attempt only after §12 phase 14)

| Bonus               | Approach                                                                                                                        | Effort |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Docker              | `docker-compose.yml` with postgres 16, backend (multi-stage node:20-alpine), frontend (build + nginx). Commit `.dockerignore`   | 1.5 h  |
| GitHub Actions      | `.github/workflows/ci.yml`: install → typecheck → lint → test on push/PR. Deployment stays on Render/Vercel auto-deploy         | 45 min |
| Challan/invoice PDF | `pdfkit` streamed from `GET /challans/:id/pdf`, rendered from snapshot data only, filename `{challanNumber}.pdf`                | 1.5 h  |
| S3 product image    | `multer` memory storage → `@aws-sdk/client-s3` `PutObject` → store the key in `Product.imageUrl`; validate mime and cap at 2 MB | 1.5 h  |

---

## 16. README outline (required deliverable)

1. Project overview and the four modules built
2. Live links — frontend URL, backend base URL, `/api/health`
3. Test credentials table (§13) and the Render cold-start note
4. Tech stack and why
5. Architecture — request flow (`route → validate → authenticate → requireRole → controller → service → Prisma`), layering rules, folder map
6. Database schema — ER description of the 8 tables and the key relationships
7. Local setup (§11.5)
8. Environment variables — table of every var, purpose, example; how secrets are managed on Render and Vercel
9. Deployment — how the server was set up, step by step (§11), plus how to redeploy
10. API documentation — endpoint table, response envelope, error codes, link to the Postman collection
11. Business rules — challan numbering, stock deduction, negative-stock prevention, snapshots, status transitions
12. Assumptions — e.g. single company/tenant, INR currency, 10-digit mobiles, prices exclusive of tax, no payment or dispatch tracking
13. Known limitations — no refresh-token rotation, token in `localStorage`, no frontend tests, no soft-delete restore UI, cold start on free tier, no audit trail outside stock movements
14. Screen recording link

---

## 17. Acceptance checklist

Verify each against the deployed app before submitting.

**Auth & roles** — [ ] JWT login · [ ] all four roles exist and log in · [ ] protected routes reject missing/invalid tokens with 401 · [ ] role restrictions return 403 · [ ] UI hides unavailable actions

**Customer CRM** — [ ] add · [ ] edit · [ ] search · [ ] detail page · [ ] follow-up notes · [ ] all 10 required fields present · [ ] status and type filters

**Products & inventory** — [ ] add · [ ] edit · [ ] all 7 required fields · [ ] movement log records product, quantity, type, reason, created-by, timestamp · [ ] low-stock indicator

**Sales challan** — [ ] select customer · [ ] multiple products with quantities · [ ] auto challan number · [ ] save as Draft or Confirmed · [ ] confirming reduces stock · [ ] stock cannot go negative · [ ] insufficient stock returns a clear error · [ ] product snapshot stored, not just IDs · [ ] all 7 challan fields present

**API quality** — [ ] input validation on every write · [ ] correct HTTP status codes · [ ] consistent error envelope · [ ] pagination on all lists · [ ] search/filter where needed

**Delivery** — [ ] GitHub repo with meaningful commit history · [ ] live frontend URL · [ ] live backend URL · [ ] credentials for all four roles · [ ] Postman collection · [ ] README with setup and deployment · [ ] architecture explanation · [ ] known limitations documented
```

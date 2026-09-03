# Godown Operations ERP

This is a Mini Operations ERP built to track inventory across multiple locations, manage work orders, execute stock transfers, and handle customer order reservations.

It provides five key modules:

1. **Auth & RBAC**: Secure login with Role-Based Access Control (Admin, Operations, Sales).
2. **Inventory**: Real-time stock tracking at the `Item × Location × Batch` grain.
3. **Work Orders**: Task assignment with real-time stock shortage calculations.
4. **Stock Transfers**: Multi-state internal transfers (Requested → Dispatched → Received).
5. **Customer Orders**: Sales order creation with robust concurrent stock reservations.

## Documentation

- **Architecture**: See [`docs/architecture.md`](./docs/architecture.md) for details on the architecture, request flow, and business invariants.
- **Deployment**: See [`docs/deployment.md`](./docs/deployment.md) for step-by-step instructions on deploying the application.
- **API Reference**: Import the [`docs/postman_collection.json`](./docs/postman_collection.json) file into Postman or Insomnia to explore the API endpoints.

## Test Credentials

| Role       | Email            | Password       |
| ---------- | ---------------- | -------------- |
| Admin      | `admin@erp.test` | `Password@123` |
| Operations | `ops@erp.test`   | `Password@123` |
| Sales      | `sales@erp.test` | `Password@123` |

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Frontend**: Next.js (App Router), TailwindCSS, TanStack Query

## Local Setup

1. Clone the repository.
2. Ensure PostgreSQL 16+ is running locally or use a remote Database URL.
3. In `backend/`:
   ```bash
   npm install
   cp .env.example .env  # Edit DATABASE_URL and JWT_SECRET
   npx prisma db push
   npm run seed
   npm run dev
   ```
4. In `frontend/`:
   ```bash
   npm install
   cp .env.example .env.local
   npm run dev
   ```

## Environment Variables

| Variable         | Purpose                        | Example                                          |
| ---------------- | ------------------------------ | ------------------------------------------------ |
| `NODE_ENV`       | Environment context            | `development`                                    |
| `PORT`           | API listen port                | `4000`                                           |
| `DATABASE_URL`   | Postgres connection string     | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET`     | Secret for signing auth tokens | `super-secret-key-change-me`                     |
| `JWT_EXPIRES_IN` | Token validity duration        | `12h`                                            |
| `CORS_ORIGINS`   | Allowed frontend domains       | `http://localhost:3000`                          |
| `LOG_LEVEL`      | Pino logger verbosity          | `info`                                           |

## Testing

Run the integration test suite in the `backend/` directory:

```bash
npm run test
```

### What the tests prove:

1. **Cannot reserve more than available**: Returns 409 `INSUFFICIENT_AVAILABLE`.
2. **Cannot transfer more than available**: Returns 409, source `physicalQty` unchanged.
3. **Destination increases only after receipt**: After dispatch, destination is unchanged. After receipt, destination goes up.
4. **Same transfer cannot be received twice**: Second receive attempt hits a conditional write guard and returns 409.
5. **Unauthorized action prevention**: Verifies RBAC (Sales cannot create Work Orders, Ops cannot reserve orders).
6. **Concurrency Guard**: Fires two overlapping reservations for stock. `SELECT ... FOR UPDATE` guarantees exactly one wins and inventory is never oversold.

## Assumptions & Limitations

- Single tenant architecture.
- Base currency is INR.
- Quantities are strictly integers ≥ 1.
- No partial dispatch of transfers.
- No refresh-token rotation (JWT is long-lived).
- Tokens stored in `localStorage` (vulnerable to XSS).

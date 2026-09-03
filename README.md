# Counterfoil

Counterfoil is a modern, monolithic web application built to streamline operations for small-to-medium businesses. It provides a cohesive suite of modules encompassing Role-Based Access Control, Customer CRM, Inventory Management, and Sales Order (Challan) processing.

By deeply linking sales to inventory, Counterfoil ensures stock integrity through transactional guardrails (preventing negative inventory) while providing robust audit logs.

## Modules Built

1. **Authentication & RBAC**: JWT-based login with distinct roles (ADMIN, SALES, WAREHOUSE, ACCOUNTS).
2. **Customer CRM**: Manage customer details, business information, and track follow-up dates.
3. **Products & Inventory**: Manage catalogs, minimum stock alerts, and view immutable stock movement logs.
4. **Sales Challans**: Draft and confirm delivery notes. Confirmation triggers atomic stock deduction and locks the challan to ensure an immutable historical snapshot. Includes PDF export and print capabilities.
5. **Dashboard**: A bird's-eye view aggregating metrics from all modules, complete with ECharts-powered visualizations and urgent-action lists.

## Live Links

- **Frontend URL**: [https://counterfoil.dinanath.dev](https://counterfoil.dinanath.dev)
- **Backend Base URL**: [https://api.counterfoil.dinanath.dev/api](https://api.counterfoil.dinanath.dev/api)
- **API Health Check**: [https://api.counterfoil.dinanath.dev/api/health](https://api.counterfoil.dinanath.dev/api/health)

_(Note: Render free tier instances spin down after inactivity. Initial API requests may take up to 50 seconds to respond as the instance wakes up)._

## Test Credentials

Use these seeded accounts to log in and explore role-based restrictions. **Password for all accounts is `Password@123`.**

| Role      | Email                               |
| --------- | ----------------------------------- |
| Admin     | `aarti.admin@counterfoil.test`      |
| Sales     | `nikhil.sales@counterfoil.test`     |
| Warehouse | `suresh.warehouse@counterfoil.test` |
| Accounts  | `meera.accounts@counterfoil.test`   |

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Shadcn/UI, React-Hook-Form, Zod, Zustand, React-Query, ECharts, jsPDF.
- **Backend**: Node.js, Express, TypeScript, Zod, Prisma ORM, Configurable Seeder.
- **Database**: PostgreSQL (Neon Serverless).
- **Tooling**: Vitest, Supertest, ESLint, Prettier.

_Why this stack?_ The combination of TypeScript across the stack with Zod validations ensures end-to-end type safety. Prisma provides a fantastic developer experience for PostgreSQL, and Next.js + Shadcn/UI allows for incredibly fast, accessible, and beautiful frontend development.

## Documentation

For a deeper dive into the system:

- [Architecture & Schema Design](docs/architecture.md)
- [Deployment Guide](docs/deployment.md)
- [Postman API Collection](docs/postman_collection.json)

## Local Setup

1. **Clone the repository**:

   ```bash
   git clone <repo-url>
   cd counterfoil
   ```

2. **Backend Setup**:

   ```bash
   cd backend
   npm install
   # Create a .env file and add your DATABASE_URL and JWT_SECRET
   npx prisma migrate dev
   npm run seed
   npm run dev
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   # Create a .env.local and add NEXT_PUBLIC_API_URL=http://localhost:4000/api
   npm run dev
   ```

## Environment Variables

### Backend (`backend/.env`)

| Variable       | Purpose                      | Example                        |
| -------------- | ---------------------------- | ------------------------------ |
| `PORT`         | API port                     | `4000`                         |
| `NODE_ENV`     | Environment context          | `development`                  |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host/db` |
| `JWT_SECRET`   | Secret for signing tokens    | `supersecretkey`               |
| `CORS_ORIGIN`  | Allowed frontend origin      | `http://localhost:3000`        |

### Frontend (`frontend/.env.local`)

| Variable              | Purpose              | Example                     |
| --------------------- | -------------------- | --------------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:4000/api` |

## Business Rules

- **Challan Numbering**: Auto-generated in the format `CHL-YYYY-XXXXX`.
- **Stock Deduction**: Triggered _only_ when a Draft Challan is confirmed.
- **Negative-Stock Prevention**: The API explicitly blocks confirming a challan if it exceeds current stock levels, returning a 409 Conflict.
- **Snapshots**: When a challan is created, the customer details and product names/prices are deeply cloned into the challan record. If the customer changes their name or a product price increases months later, the historical challan remains perfectly intact.
- **Status Transitions**: DRAFT -> CONFIRMED. Once CONFIRMED, it cannot go back to DRAFT. It can only go to CANCELLED (which restores stock).

## Known Limitations

- Tokens are stored in `localStorage` without HttpOnly cookies.
- No Refresh-Token rotation is implemented.
- The UI does not support restoring soft-deleted records (must be done via raw DB).
- No audit trail for entity changes outside of Inventory Stock Movements.
- Assumes INR currency and single company tenant.
- Currently the UI does not support mobile view, for better exprience use desktop only.

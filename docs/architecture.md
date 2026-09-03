# Counterfoil Architecture

Counterfoil is a full-stack monolithic web application divided into a Node.js Express backend and a Next.js React frontend. The application uses PostgreSQL as its primary datastore and Prisma as its ORM.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Zod (validation), Prisma ORM
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Shadcn/UI (Radix UI primitives)
- **Database:** PostgreSQL (Neon Serverless)
- **Tooling:** Vite/Vitest for unit testing, ESLint, Prettier

## Backend Architecture

The backend follows a classic 3-tier Controller-Service-Repository architecture.

### Request Flow

1. **Route Layer (`/routes`)**: Defines API endpoints and binds them to specific controllers. Applies authentication (`authenticate`) and authorization (`requireRole`) middleware.
2. **Controller Layer (`/controllers`)**: Handles HTTP concerns. Extracts parameters, bodies, and queries, parses them through Zod schemas, invokes the Service layer, and formats the HTTP response envelope.
3. **Service Layer (`/services`)**: Contains core business logic. Responsible for orchestrating multiple database calls, enforcing invariants (e.g., preventing negative stock), and throwing `AppError` instances if business rules are violated.
4. **Data Layer (`Prisma`)**: Interacts directly with the PostgreSQL database.

### Core Modules

- **Auth**: Manages JWT generation, bcrypt password hashing, and user sessions.
- **Customers**: Manages the CRM data, follow-ups, and soft-deletion.
- **Products**: Manages inventory catalog, minimum stock thresholds, and stock movement logs.
- **Challans**: The most complex module. Manages the lifecycle of sales challans (Draft -> Confirmed -> Cancelled) and orchestrates atomic transactions to deduct stock in the Product module.
- **Dashboard**: A read-only aggregation module that pulls metrics from all other modules for the frontend.

## Database Schema (ER Diagram)

The database consists of 6 primary tables:

1. **User**: Stores employee credentials and their RBAC `Role` (ADMIN, SALES, WAREHOUSE, ACCOUNTS).
2. **Customer**: Stores client business details, contact information, and CRM follow-up dates.
3. **Product**: Stores inventory items, SKUs, pricing, current stock levels, and minimum stock alerts.
4. **StockMovement**: An append-only audit log tracking every `IN` and `OUT` adjustment to a product's stock, linked to the `User` who made the change.
5. **Challan**: Represents a sales order or delivery note. Belongs to a `Customer`. Tracks status (`DRAFT`, `CONFIRMED`, `CANCELLED`).
6. **ChallanItem**: Line items for a Challan. Stores the exact quantity and unit price at the time of creation to serve as an immutable snapshot.

### Key Relationships

- `Customer` (1) to `Challan` (N)
- `Challan` (1) to `ChallanItem` (N)
- `Product` (1) to `ChallanItem` (N)
- `Product` (1) to `StockMovement` (N)
- `User` (1) to `StockMovement` (N)

## Frontend Architecture

The frontend is built using **Next.js App Router** but heavily leans into Client Components (`"use client"`) for interactivity, behaving largely like a Single Page Application (SPA).

- **API Client**: Uses `axios` wrapped with interceptors to automatically inject the JWT token from Zustand into every request.
- **State Management**:
  - `Zustand` is used for global client-side state (User Auth context).
  - `@tanstack/react-query` is used for server-state caching, fetching, and optimistic UI updates.
- **Styling**: Tailwind CSS combined with `shadcn/ui` for accessible, unstyled Radix UI primitives.
- **Forms**: `react-hook-form` paired with `@hookform/resolvers/zod` for robust client-side validation mirroring the backend schemas.

## Business Rules & Invariants

1. **Stock Deduction**: Stock is only deducted when a Challan transitions from `DRAFT` to `CONFIRMED`.
2. **Negative Stock Prevention**: A challan cannot be confirmed if any of its line items exceed the current available stock of that product.
3. **Immutability**: Once a Challan is confirmed, it cannot be edited. It can only be cancelled, which reverses the stock deduction via new `IN` stock movements.

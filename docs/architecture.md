# Godown Architecture

Godown is a full-stack monolithic web application divided into a Node.js Express backend and a Next.js React frontend. The application uses PostgreSQL as its primary datastore and Prisma as its ORM.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Zod (validation), Prisma ORM
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Shadcn/UI
- **Database:** PostgreSQL (Neon Serverless)
- **Tooling:** Vite/Vitest for unit testing, ESLint, Prettier

## Backend Architecture

The backend follows a classic 3-tier Controller-Service-Repository architecture.

### Request Flow

1. **Route Layer (`src/modules/{module-name}/routes.ts`)**: Defines API endpoints and binds them to specific controllers. Applies authentication (`authenticate`) and authorization (`requireRole`) middleware.
2. **Controller Layer (`src/modules/{module-name}/controller.ts`)**: Handles HTTP concerns. Extracts parameters, bodies, and queries, parses them through Zod schemas (`schema.ts`), invokes the Service layer, and formats the HTTP response envelope.
3. **Service Layer (`src/modules/{module-name}/service.ts`)**: Contains core business logic. Responsible for orchestrating multiple database calls, enforcing invariants (e.g., preventing overselling), and throwing `AppError` instances if business rules are violated.
4. **Data Layer (`Prisma`)**: Interacts directly with the PostgreSQL database.

### Core Modules

- **Auth**: Manages JWT generation, bcrypt password hashing, and user sessions.
- **Inventory**: Tracks real-time stock at the `Item × Location × Batch` grain, along with manual adjustments.
- **Work Orders**: Task assignment with real-time stock shortage calculations.
- **Transfers**: Internal stock movements with state transitions (Requested → Dispatched → Received).
- **Orders**: Sales orders managing concurrent stock reservations and cancellations.

## Database Schema

The database relies on strict row-level tracking and transaction management:

1. **User, Location, Category, Item, Batch**: Master data tables.
2. **InventoryItem**: Tracks physical and reserved quantities per item/location/batch.
3. **StockMovement**: Append-only ledger of stock changes (`IN`/`OUT`).
4. **StockTransfer**: Tracks transit of items between locations.
5. **WorkOrder**: Tracks required quantity against available quantity at a location.
6. **CustomerOrder & CustomerOrderLine**: Sales orders.
7. **StockReservation**: The precise ledger of reserved quantities linking an order line to an inventory row.

## Frontend Architecture

- **API Client**: Uses `axios` wrapped with interceptors for JWT injection.
- **State Management**:
  - `Zustand` for global client-side state (User Auth context).
  - `@tanstack/react-query` for server-state caching and fetching.
- **Forms**: `react-hook-form` + `zod` for robust client-side validation mirroring the backend schemas.

## Business Rules & Invariants

1. **Available Quantity**: Computed as `physicalQty - reservedQty` dynamically. It is never stored to prevent drift.
2. **Reservation Concurrency**: Handled via `SELECT ... FOR UPDATE` row locks, ensuring exactly one transaction succeeds when competing for identical stock.
3. **Transfer Receipt Idempotency**: Status transitions use conditional writes to guarantee a transfer cannot be received twice.

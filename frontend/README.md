# Godown Operations ERP - Frontend

This is the frontend application for the Godown Operations ERP, built using [Next.js](https://nextjs.org/) (App Router).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4, Shadcn UI
- **State Management**: Zustand (Client-side state), TanStack React Query (Server state caching)
- **Forms & Validation**: React Hook Form + Zod
- **API Client**: Axios

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Ensure `NEXT_PUBLIC_API_URL` points to your backend instance (e.g., `http://localhost:4000/api` or `https://api.godown.dinanath.dev/api`).

3. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Structure

- `/src/app`: Next.js App Router pages (e.g., `(auth)`, `(dashboard)`).
- `/src/components`: Reusable UI components (including Shadcn UI components).
- `/src/lib`: Utility functions and generic hooks.
- `/src/store`: Zustand state stores (e.g., User Auth context).

## Deployment

To deploy the frontend to Vercel or any other static site host:

```bash
npm run build
npm start
```

Ensure that you have set the `NEXT_PUBLIC_API_URL` environment variable properly in your deployment platform to point to your backend.

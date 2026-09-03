# Deployment Guide

Counterfoil is designed to be deployed with the Backend hosted on **Render** (as a Web Service) and the Frontend hosted on **Vercel**.

## 1. Prerequisites

- A PostgreSQL database (e.g., Neon, Supabase, or AWS RDS).
- A GitHub repository containing the Counterfoil source code.
- Accounts on Render and Vercel.

## 2. Backend Deployment (Render)

1. Log into [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Name**: `counterfoil-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build && npx prisma generate && npx prisma migrate deploy && npx prisma db seed`
   - **Start Command**: `npm start`
5. Configure Environment Variables (under the "Environment" tab):
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `JWT_SECRET`: A strong, random string (e.g., generated via `openssl rand -base64 32`).
   - `PORT`: `10000` (Render's default)
   - `NODE_ENV`: `production`
6. Click **Create Web Service**.
7. Wait for the build to complete and note down the provided `onrender.com` URL.

_(Note: The build command above automatically runs database migrations and seeds the initial data so you do not need shell access!)_

## 3. Frontend Deployment (Vercel)

1. Log into [Vercel](https://vercel.com/).
2. Click **Add New...** and select **Project**.
3. Import your GitHub repository.
4. Configure the project:
   - **Project Name**: `counterfoil`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: The URL of your Render backend (e.g., `https://counterfoil-api.onrender.com/api`).
6. Click **Deploy**.
7. Vercel will automatically build and assign a `.vercel.app` domain.

## 4. Final Configuration (CORS)

Once you have your Vercel frontend URL:

1. Go back to your Render Backend environment variables.
2. Add a new variable: `CORS_ORIGIN` = `https://your-vercel-app-url.vercel.app`.
3. Restart the Render Web Service to apply the new CORS policy.

You can now log in using the seed accounts provided in the README!

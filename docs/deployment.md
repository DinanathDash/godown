# Deployment Guide

Godown can be deployed on any standard Node.js hosting platform (Backend) and static site host (Frontend).

## 1. Prerequisites

- A PostgreSQL database (e.g., Neon, AWS RDS).
- A Node.js environment (v20+).

## 2. Backend Deployment

1. Set up a Node.js server or a PaaS (like Heroku or Render).
2. Set the following environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `JWT_SECRET`: A strong, random string.
   - `NODE_ENV`: `production`
   - `PORT`: e.g. `4000`
3. Run the deployment commands:
   ```bash
   npm install --include=dev
   npm run build
   npx prisma generate
   npx prisma db push
   npm run seed
   npm start
   ```

## 3. Frontend Deployment (Vercel)

1. Log into [Vercel](https://vercel.com/).
2. Import the GitHub repository.
3. Configure the project:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
4. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: The URL of your backend (e.g., `https://api.godown.dinanath.dev/api`).
5. Click **Deploy**.

## 4. CORS Configuration

Once the frontend is deployed:

1. Update the backend `CORS_ORIGINS` environment variable to include the frontend URL (`https://godown.dinanath.dev`).
2. Restart the backend service.

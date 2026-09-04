import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const getPrismaUrl = () => {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('-pooler.') && url.includes('neon.tech') && !url.includes('pgbouncer=true')) {
    return url.includes('?') ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: { url: getPrismaUrl() },
    },
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

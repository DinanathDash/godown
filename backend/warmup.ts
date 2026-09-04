import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  for (let i = 0; i < 15; i++) {
    try {
      console.log(`Attempt ${i + 1}...`);
      await prisma.$executeRaw`SELECT 1`;
      console.log('DB connected and warmed up!');
      process.exit(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.log(`Retry ${i + 1} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log('Could not connect to DB after 15 attempts.');
  process.exit(1);
}

main();

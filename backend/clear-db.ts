import { prisma } from './src/lib/prisma';

async function clearDb() {
  console.log('Clearing db...');
  await prisma.stockReservation.deleteMany();
  await prisma.customerOrderLine.deleteMany();
  await prisma.customerOrder.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.inventoryTransfer.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.item.deleteMany();
  await prisma.location.deleteMany();
  await prisma.counter.deleteMany();
  console.log('Done!');
}

clearDb()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

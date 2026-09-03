import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'Password@123';

async function main() {
  console.log('Resetting database...');
  // Delete in reverse dependency order
  await prisma.stockReservation.deleteMany();
  await prisma.customerOrderLine.deleteMany();
  await prisma.customerOrder.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.counter.deleteMany();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log('Seeding Locations...');
  const locMum = await prisma.location.create({ data: { code: 'WH-MUM', name: 'Mumbai Warehouse' } });
  const locPun = await prisma.location.create({ data: { code: 'WH-PUN', name: 'Pune Warehouse' } });
  const locDel = await prisma.location.create({ data: { code: 'WH-DEL', name: 'Delhi Warehouse' } });
  const locations = [locMum, locPun, locDel];

  console.log('Seeding Users...');
  await prisma.user.create({ data: { name: 'Aarti Deshpande', email: 'aarti.admin@godown.test', passwordHash, role: 'ADMIN', locationId: locMum.id } });
  const sales = await prisma.user.create({ data: { name: 'Nikhil Verma', email: 'nikhil.sales@godown.test', passwordHash, role: 'SALES', locationId: locMum.id } });
  const ops = await prisma.user.create({ data: { name: 'Suresh Pawar', email: 'suresh.warehouse@godown.test', passwordHash, role: 'OPERATIONS', locationId: locMum.id } });

  console.log('Seeding Categories...');
  const catHw = await prisma.category.create({ data: { name: 'Hardware' } });
  const catTl = await prisma.category.create({ data: { name: 'Tools' } });
  const catPl = await prisma.category.create({ data: { name: 'Plumbing' } });
  const catSf = await prisma.category.create({ data: { name: 'Safety' } });

  console.log('Seeding Items & Inventory...');
  const itemsData = [
    { sku: 'HW-1001', name: 'Steel Bolt 10mm x 50mm', categoryId: catHw.id },
    { sku: 'HW-1002', name: 'Steel Nut 10mm', categoryId: catHw.id },
    { sku: 'HW-1003', name: 'Flat Washer 10mm', categoryId: catHw.id },
    { sku: 'HW-1004', name: 'Spring Washer 10mm', categoryId: catHw.id },
    { sku: 'HW-1005', name: 'Hex Bolt 12mm x 75mm', categoryId: catHw.id },
    { sku: 'TL-2001', name: 'Claw Hammer 500g', categoryId: catTl.id },
    { sku: 'TL-2002', name: 'Ball Peen Hammer 300g', categoryId: catTl.id },
    { sku: 'TL-2003', name: 'Adjustable Wrench 10 inch', categoryId: catTl.id },
    { sku: 'TL-2004', name: 'Combination Spanner Set (8pc)', categoryId: catTl.id },
    { sku: 'TL-2005', name: 'Screwdriver Set (6pc)', categoryId: catTl.id },
    { sku: 'PL-3001', name: 'PVC Pipe 1 inch (3m)', categoryId: catPl.id },
    { sku: 'PL-3002', name: 'PVC Pipe 2 inch (3m)', categoryId: catPl.id },
    { sku: 'PL-3003', name: 'PVC Elbow 1 inch', categoryId: catPl.id },
    { sku: 'PL-3004', name: 'PVC Tee 1 inch', categoryId: catPl.id },
    { sku: 'PL-3005', name: 'PVC Coupler 1 inch', categoryId: catPl.id },
    { sku: 'SF-4001', name: 'Safety Goggles Clear', categoryId: catSf.id },
    { sku: 'SF-4002', name: 'Work Gloves (Leather)', categoryId: catSf.id },
    { sku: 'SF-4003', name: 'Nitrile Gloves (Pack of 50)', categoryId: catSf.id },
    { sku: 'SF-4004', name: 'Safety Helmet (Yellow)', categoryId: catSf.id },
    { sku: 'SF-4005', name: 'Reflective Safety Vest', categoryId: catSf.id },
  ];

  const allItems = [];
  for (const data of itemsData) {
    const item = await prisma.item.create({ data });
    allItems.push(item);
    // Create a batch
    const batch = await prisma.batch.create({
      data: { itemId: item.id, code: `B-2026-${Math.floor(Math.random() * 1000)}` },
    });
    // Create inventory in each location with some random stock
    for (const loc of locations) {
      const physicalQty = Math.floor(Math.random() * 500) + 10;
      const invItem = await prisma.inventoryItem.create({
        data: {
          itemId: item.id,
          locationId: loc.id,
          batchId: batch.id,
          physicalQty,
        }
      });
      // Add opening stock movement
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: invItem.id,
          type: 'IN',
          quantity: physicalQty,
          balanceAfter: physicalQty,
          reason: 'OPENING_STOCK',
          createdById: ops.id,
        }
      });
    }
  }

  console.log('Seeding Customers...');
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    const cust = await prisma.customer.create({
      data: {
        name: `Customer ${i}`,
        businessName: `Business ${i} Ltd`,
        mobile: `987654321${i % 10}`,
        email: `customer${i}@example.com`,
      }
    });
    customers.push(cust);
  }

  console.log('Seeding Orders & WorkOrders...');
  // 1 Reserved Order
  const order = await prisma.customerOrder.create({
    data: {
      code: 'ORD-2026-00001',
      customerId: customers[0].id,
      locationId: locMum.id,
      status: 'RESERVED',
      createdById: sales.id,
      lines: {
        create: [
          {
            itemId: allItems[0].id,
            quantity: 10,
          }
        ]
      }
    },
    include: { lines: true }
  });

  const line = order.lines[0];
  const invToReserve = await prisma.inventoryItem.findFirst({
    where: { itemId: line.itemId, locationId: locMum.id }
  });
  if (invToReserve) {
    await prisma.inventoryItem.update({
      where: { id: invToReserve.id },
      data: { reservedQty: 10 }
    });
    await prisma.stockReservation.create({
      data: {
        orderLineId: line.id,
        inventoryItemId: invToReserve.id,
        quantity: 10
      }
    });
  }

  // 2 Work Orders
  await prisma.workOrder.create({
    data: {
      code: 'WO-2026-00001',
      locationId: locMum.id,
      itemId: allItems[1].id,
      requiredQty: 50,
      assignedToId: ops.id,
      status: 'ASSIGNED'
    }
  });

  await prisma.workOrder.create({
    data: {
      code: 'WO-2026-00002',
      locationId: locPun.id,
      itemId: allItems[2].id,
      requiredQty: 10000, // Shortage
      assignedToId: ops.id,
      status: 'ASSIGNED'
    }
  });

  console.log('Seeding Transfers...');
  // Requested
  const batch1 = await prisma.batch.findFirst({ where: { itemId: allItems[3].id } });
  if (batch1) {
    await prisma.stockTransfer.create({
      data: {
        code: 'TRF-2026-00001',
        itemId: allItems[3].id,
        batchId: batch1.id,
        sourceLocationId: locMum.id,
        destinationLocationId: locPun.id,
        quantity: 20,
        requestedById: ops.id,
        status: 'REQUESTED'
      }
    });
  }

  // Dispatched
  const batch2 = await prisma.batch.findFirst({ where: { itemId: allItems[4].id } });
  if (batch2) {
    const invSrc = await prisma.inventoryItem.findFirst({ where: { itemId: allItems[4].id, locationId: locMum.id, batchId: batch2.id }});
    if (invSrc) {
      await prisma.stockTransfer.create({
        data: {
          code: 'TRF-2026-00002',
          itemId: allItems[4].id,
          batchId: batch2.id,
          sourceLocationId: locMum.id,
          destinationLocationId: locPun.id,
          quantity: 30,
          dispatchedQty: 30,
          requestedById: ops.id,
          status: 'DISPATCHED',
          dispatchedAt: new Date()
        }
      });
      await prisma.inventoryItem.update({
        where: { id: invSrc.id },
        data: { physicalQty: { decrement: 30 } }
      });
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: invSrc.id,
          type: 'OUT',
          quantity: 30,
          balanceAfter: invSrc.physicalQty - 30,
          reason: 'TRANSFER_OUT',
          createdById: ops.id,
        }
      });
    }
  }

  // Received
  const batch3 = await prisma.batch.findFirst({ where: { itemId: allItems[5].id } });
  if (batch3) {
    const invDest = await prisma.inventoryItem.findFirst({ where: { itemId: allItems[5].id, locationId: locPun.id, batchId: batch3.id }});
    if (invDest) {
      await prisma.stockTransfer.create({
        data: {
          code: 'TRF-2026-00003',
          itemId: allItems[5].id,
          batchId: batch3.id,
          sourceLocationId: locMum.id,
          destinationLocationId: locPun.id,
          quantity: 40,
          dispatchedQty: 40,
          receivedQty: 40,
          requestedById: ops.id,
          status: 'RECEIVED',
          dispatchedAt: new Date(),
          receivedAt: new Date()
        }
      });
      // Assuming it was already decremented from source and now we increment destination
      await prisma.inventoryItem.update({
        where: { id: invDest.id },
        data: { physicalQty: { increment: 40 } }
      });
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: invDest.id,
          type: 'IN',
          quantity: 40,
          balanceAfter: invDest.physicalQty + 40,
          reason: 'TRANSFER_IN',
          createdById: ops.id,
        }
      });
    }
  }

  // Set Counter
  await prisma.counter.create({ data: { key: 'challan_seq', value: 10 } });

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

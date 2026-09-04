import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { Prisma, WorkOrderStatus } from '@prisma/client';

const TX_OPTIONS = { timeout: 20000, maxWait: 15000 } as const;

export async function getWorkOrders(query: {
  page: number;
  limit: number;
  status?: WorkOrderStatus;
  locationId?: string;
}) {
  const { page, limit, status, locationId } = query;
  const where: Prisma.WorkOrderWhereInput = {
    ...(status && { status }),
    ...(locationId && { locationId }),
  };

  const [total, data] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        location: true,
        item: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Compute available and shortage per row
  const enrichedData = await Promise.all(
    data.map(async (wo) => {
      const [{ available }] = await prisma.$queryRaw<{ available: number }[]>`
        SELECT COALESCE(SUM("physicalQty" - "reservedQty"), 0)::int AS available
        FROM inventory_items
        WHERE "itemId" = ${wo.itemId} AND "locationId" = ${wo.locationId}
      `;
      return {
        ...wo,
        availableQty: available,
        shortageQty: Math.max(0, wo.requiredQty - available),
      };
    }),
  );

  return {
    data: enrichedData,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createWorkOrder(data: {
  locationId: string;
  itemId: string;
  requiredQty: number;
  assignedToId: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Check assignee exists and has OPERATIONS role (business rule assumption, though assigning to self/any valid user might be fine. Let's just check existence)
    await tx.user.findUniqueOrThrow({ where: { id: data.assignedToId } });

    // Generate code
    const code = `WO-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return tx.workOrder.create({
      data: {
        code,
        locationId: data.locationId,
        itemId: data.itemId,
        requiredQty: data.requiredQty,
        assignedToId: data.assignedToId,
        status: 'ASSIGNED',
      },
    });
  }, TX_OPTIONS);
}

export async function getWorkOrderById(id: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      location: true,
      item: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!wo) throw new AppError(404, 'NOT_FOUND', 'Work order not found');

  const [{ available }] = await prisma.$queryRaw<{ available: number }[]>`
    SELECT COALESCE(SUM("physicalQty" - "reservedQty"), 0)::int AS available
    FROM inventory_items
    WHERE "itemId" = ${wo.itemId} AND "locationId" = ${wo.locationId}
  `;

  return {
    ...wo,
    availableQty: available,
    shortageQty: Math.max(0, wo.requiredQty - available),
  };
}

export async function updateWorkOrderStatus(id: string, newStatus: WorkOrderStatus) {
  return prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUniqueOrThrow({ where: { id } });

    // Enforce forward-only status progression: ASSIGNED -> IN_PROGRESS -> COMPLETED
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      ASSIGNED: ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED'],
      COMPLETED: [],
    };

    if (!validTransitions[wo.status].includes(newStatus)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${wo.status} to ${newStatus}`,
      );
    }

    return tx.workOrder.update({
      where: { id },
      data: { status: newStatus },
      include: {
        location: true,
        item: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
  }, TX_OPTIONS);
}

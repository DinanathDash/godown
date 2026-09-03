import { z } from 'zod';
import { WorkOrderStatus } from '@prisma/client';

export const listWorkOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    status: z.nativeEnum(WorkOrderStatus).optional(),
    locationId: z.string().uuid().optional(),
  }),
});

export const createWorkOrderSchema = z.object({
  body: z.object({
    locationId: z.string().uuid(),
    itemId: z.string().uuid(),
    requiredQty: z.number().int().min(1),
    assignedToId: z.string().uuid(),
  }),
});

export const workOrderIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const updateWorkOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.nativeEnum(WorkOrderStatus),
  }),
});

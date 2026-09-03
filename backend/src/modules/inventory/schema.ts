import { z } from 'zod';

export const getInventoryQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adjustStockSchema = z.object({
  inventoryItemId: z.string().uuid(),
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive(),
  reason: z.string().min(3),
});

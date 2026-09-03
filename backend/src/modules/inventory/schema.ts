import { z } from 'zod';

export const getInventoryQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  /** Matches item name or SKU, case-insensitive. */
  search: z.string().trim().min(1).optional(),
  /**
   * IN_STOCK / OUT_OF_STOCK compare physicalQty against reservedQty, so this
   * filters on *available*, which is what actually governs whether a row can
   * be reserved or dispatched.
   */
  availability: z.enum(['ALL', 'IN_STOCK', 'OUT_OF_STOCK']).optional().default('ALL'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adjustStockSchema = z.object({
  inventoryItemId: z.string().uuid(),
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive(),
  reason: z.string().min(3),
});

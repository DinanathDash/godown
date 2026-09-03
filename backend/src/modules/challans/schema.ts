import { z } from 'zod';
import { ChallanStatus } from '@prisma/client';

const challanItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional(),
});

export const createChallanSchema = z.object({
  body: z.object({
    customerId: z.string().uuid(),
    status: z.enum([ChallanStatus.DRAFT, ChallanStatus.CONFIRMED]).optional(),
    notes: z.string().optional().or(z.literal('')),
    items: z.array(challanItemSchema).min(1, 'At least one item is required'),
  }),
});

export const updateChallanSchema = z.object({
  body: z.object({
    notes: z.string().optional().or(z.literal('')),
    items: z.array(challanItemSchema).min(1).optional(),
  }),
});

export const queryChallanSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    status: z.nativeEnum(ChallanStatus).optional(),
    q: z.string().optional(),
  }),
});

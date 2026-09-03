import { z } from 'zod';
import { MovementType } from '@prisma/client';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().min(1, 'SKU is required'),
    category: z.string().optional().or(z.literal('')),
    unitPrice: z.number().positive('Unit price must be positive'),
    minStockAlert: z.number().int().min(0).default(0),
    location: z.string().optional().or(z.literal('')),
    imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    sku: z.string().min(1).optional(),
    category: z.string().optional().or(z.literal('')),
    unitPrice: z.number().positive().optional(),
    minStockAlert: z.number().int().min(0).optional(),
    location: z.string().optional().or(z.literal('')),
    imageUrl: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }),
});

export const adjustStockSchema = z.object({
  body: z.object({
    type: z.nativeEnum(MovementType),
    quantity: z.number().int().positive('Quantity must be positive'),
    reason: z.string().min(1, 'Reason is required'),
  }),
});

export const queryProductSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    q: z.string().optional(),
    category: z.string().optional(),
  }),
});

import { z } from 'zod';
import { TransferStatus } from '@prisma/client';

export const listTransfersSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    status: z.nativeEnum(TransferStatus).optional(),
    sourceLocationId: z.string().uuid().optional(),
    destinationLocationId: z.string().uuid().optional(),
  }),
});

export const createTransferSchema = z.object({
  body: z.object({
    itemId: z.string().uuid(),
    batchId: z.string().uuid(),
    sourceLocationId: z.string().uuid(),
    destinationLocationId: z.string().uuid(),
    quantity: z.number().int().min(1),
  }),
});

export const transferIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

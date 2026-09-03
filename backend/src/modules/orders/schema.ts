import { z } from 'zod';

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    customerId: z.string().uuid(),
    locationId: z.string().uuid(),
    lines: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          quantity: z.number().int().min(1),
        }),
      )
      .min(1),
  }),
});

export const orderIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

import { z } from 'zod';
import { CustomerType, CustomerStatus } from '@prisma/client';

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    mobile: z.string().min(1, 'Mobile is required'),
    email: z.string().email().optional().or(z.literal('')),
    businessName: z.string().optional().or(z.literal('')),
    gstNumber: z.string().optional().or(z.literal('')),
    type: z.nativeEnum(CustomerType).optional(),
    address: z.string().optional().or(z.literal('')),
    status: z.nativeEnum(CustomerStatus).optional(),
    followUpDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional().or(z.literal('')),
  }),
});

export const updateCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    mobile: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal('')),
    businessName: z.string().optional().or(z.literal('')),
    gstNumber: z.string().optional().or(z.literal('')),
    type: z.nativeEnum(CustomerType).optional(),
    address: z.string().optional().or(z.literal('')),
    status: z.nativeEnum(CustomerStatus).optional(),
    followUpDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional().or(z.literal('')),
  }),
});

export const addNoteSchema = z.object({
  body: z.object({
    note: z.string().min(1, 'Note cannot be empty'),
    followUpDate: z.string().datetime().optional().nullable(),
    status: z.nativeEnum(CustomerStatus).optional(),
  }),
});

export const CUSTOMER_SORT_FIELDS = ['name', 'businessName'] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];
export type CustomerSort = { field: CustomerSortField; order: 'asc' | 'desc' };

const SORT_TOKEN = /^(name|businessName):(asc|desc)$/;

/**
 * Turns the `sort` query string into an ordered list, most significant first.
 *
 * This lives here next to the validation rather than as a zod `.transform()`,
 * because transforms on `query` never reach the route: Express 5's `req.query`
 * is a getter that re-parses the querystring on every access, so the
 * `Object.assign(req.query, ...)` write-back in the validate middleware
 * mutates a throwaway object. The service therefore receives the raw string
 * and parses it with this.
 */
export function parseCustomerSort(value?: string): CustomerSort[] {
  if (!value) return [];

  const seen = new Set<string>();
  const parsed: CustomerSort[] = [];

  for (const token of value.split(',')) {
    const match = SORT_TOKEN.exec(token);
    if (!match) continue; // already rejected by the schema; belt and braces
    const [, field, order] = match;
    // First mention of a field wins, so a repeated column can't quietly
    // contradict itself or pad the ordering.
    if (seen.has(field)) continue;
    seen.add(field);
    parsed.push({ field, order } as CustomerSort);
  }

  return parsed;
}

export const queryCustomerSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    q: z.string().optional(),
    status: z.nativeEnum(CustomerStatus).optional(),
    type: z.nativeEnum(CustomerType).optional(),
    // Validation only — the parsing happens in parseCustomerSort above.
    // An empty token (from a trailing comma, say) is malformed and 400s,
    // rather than being quietly dropped.
    sort: z
      .string()
      .optional()
      .refine(
        (value) => !value || value.split(',').every((t) => SORT_TOKEN.test(t)),
        {
          message: `Expected comma-separated <${CUSTOMER_SORT_FIELDS.join('|')}>:<asc|desc>`,
        },
      ),
  }),
});

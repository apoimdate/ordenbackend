import { z } from 'zod';

export const createLoyaltySchema = z.object({
  body: z.object({
    userId: z.string(),
    points: z.number().int(),
  }),
});

export const getLoyaltySchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const getLoyaltysSchema = z.object({
  querystring: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

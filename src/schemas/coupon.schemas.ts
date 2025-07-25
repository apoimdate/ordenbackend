import { z } from 'zod';

export const createCouponSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
  }),
});

export const updateCouponSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
  }),
});

export const getCouponSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const getCouponsSchema = z.object({
  querystring: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

export const deleteCouponSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

import { z } from 'zod';

export const createFlashSaleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  discountPercentage: z.number().min(0).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  productIds: z.array(z.string()),
  maxQuantityPerUser: z.number().int().optional(),
  totalQuantityLimit: z.number().int().optional(),
  createdBy: z.string(),
});

export const updateFlashSaleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  productIds: z.array(z.string()).optional(),
  maxQuantityPerUser: z.number().int().optional(),
  totalQuantityLimit: z.number().int().optional(),
});

export const flashSaleParamsSchema = z.object({
  id: z.string(),
});

export const flashSaleQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

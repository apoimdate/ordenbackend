import { z } from 'zod';

export const createFlashSaleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean().optional(),
});

export const updateFlashSaleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const flashSaleParamsSchema = z.object({
  id: z.string(),
});

export const flashSaleQuerySchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

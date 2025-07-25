
import { z } from 'zod';

export const findManyStockLocationSchema = z.object({
  querystring: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const findStockLocationByIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const createStockLocationSchema = z.object({
  body: z.object({
    name: z.string(),
    seller_id: z.string(),
  }),
});

export const updateStockLocationSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().optional(),
  }),
});

export const deleteStockLocationRequestSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  product_id: z.string(),
  variant_id: z.string().optional(),
  stock_location_id: z.string(),
  quantity: z.number(),
});

export const updateInventoryItemSchema = z.object({
  quantity: z.number(),
});

export const inventoryItemParamsSchema = z.object({
  id: z.string(),
});

export const inventoryItemQuerySchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

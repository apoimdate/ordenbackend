import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  productId: z.string(),
  stockLocationId: z.string(),
  quantity: z.number().int(),
  notes: z.string().optional(),
});

export const updateInventoryItemSchema = z.object({
  quantity: z.number().int().optional(),
  notes: z.string().optional(),
});

export const inventoryItemParamsSchema = z.object({
  id: z.string(),
});

export const inventoryItemQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

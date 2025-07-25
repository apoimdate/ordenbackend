import { z } from 'zod';

export const createInventoryAdjustmentSchema = z.object({
  inventory_item_id: z.string(),
  user_id: z.string(),
  quantity_adjusted: z.number(),
  reason: z.string(),
});

export const updateInventoryAdjustmentSchema = z.object({
  quantity_adjusted: z.number().optional(),
  reason: z.string().optional(),
});

export const inventoryAdjustmentParamsSchema = z.object({
  id: z.string(),
});

export const inventoryAdjustmentQuerySchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

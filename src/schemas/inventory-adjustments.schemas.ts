import { z } from 'zod';

export const createInventoryAdjustmentSchema = z.object({
  productId: z.string(),
  quantity: z.number().int(),
  reason: z.string(),
  notes: z.string().optional(),
});

export const updateInventoryAdjustmentSchema = z.object({
  quantity: z.number().int().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryAdjustmentParamsSchema = z.object({
  id: z.string(),
});

export const inventoryAdjustmentQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

import { z } from 'zod';

export const createInventoryMovementSchema = z.object({
  product_id: z.string(),
  variant_id: z.string().optional(),
  type: z.string(),
  quantity_change: z.number(),
  reason: z.string().optional(),
  reference_id: z.string().optional(),
  reference_type: z.string().optional(),
});

export const updateInventoryMovementSchema = z.object({
  product_id: z.string().optional(),
  variant_id: z.string().optional(),
  type: z.string().optional(),
  quantity_change: z.number().optional(),
  reason: z.string().optional(),
  reference_id: z.string().optional(),
  reference_type: z.string().optional(),
});

export const inventoryMovementParamsSchema = z.object({
  id: z.string(),
});

export const inventoryMovementQuerySchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

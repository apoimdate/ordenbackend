import { z } from 'zod';

export const inventoryMovementParamsSchema = z.object({
  id: z.string(),
});

export const inventoryMovementQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

export const createInventoryMovementSchema = z.object({
  productId: z.string(),
  inventoryItemId: z.string(),
  quantity: z.number().int(),
  type: z.string(),
});

export const updateInventoryMovementSchema = z.object({
  quantity: z.number().int().optional(),
  type: z.string().optional(),
});

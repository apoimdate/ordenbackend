
import { z } from 'zod';

export const createStockTransferSchema = z.object({
  fromStockLocationId: z.string().uuid(),
  toStockLocationId: z.string().uuid(),
  transferDate: z.string().datetime(),
  notes: z.string().optional(),
});

export const findManyStockTransferSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const findStockTransferByIdSchema = z.object({
  id: z.string().uuid(),
});

export const updateStockTransferSchema = z.object({
  fromStockLocationId: z.string().uuid().optional(),
  toStockLocationId: z.string().uuid().optional(),
  transferDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

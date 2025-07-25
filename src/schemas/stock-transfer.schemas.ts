import { z } from 'zod';

export const findManyStockTransferRequestSchema = z.object({
  querystring: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const findStockTransferByIdRequestSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const createStockTransferRequestSchema = z.object({
  body: z.object({
    fromLocationId: z.string(),
    toLocationId: z.string(),
    transferredBy: z.string(),
    items: z.any(),
  }),
});

export const updateStockTransferRequestSchema = z.object({
  body: z.object({
    status: z.string().optional(),
    items: z.any().optional(),
  }),
});

export const deleteStockTransferRequestSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});
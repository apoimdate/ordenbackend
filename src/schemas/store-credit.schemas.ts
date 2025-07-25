import { z } from 'zod';

export const findManyStoreCreditRequestSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});
export type FindManyStoreCreditRequest = z.infer<typeof findManyStoreCreditRequestSchema>;

export const findStoreCreditByIdRequestSchema = z.object({
  id: z.string(),
});
export type FindStoreCreditByIdRequest = z.infer<typeof findStoreCreditByIdRequestSchema>;

export const createStoreCreditRequestSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  reason: z.string(),
  expiresAt: z.string().optional(),
});
export type CreateStoreCreditRequest = z.infer<typeof createStoreCreditRequestSchema>;

export const updateStoreCreditRequestSchema = z.object({
  amount: z.number().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
});
export type UpdateStoreCreditRequest = z.infer<typeof updateStoreCreditRequestSchema>;

export const deleteStoreCreditRequestSchema = z.object({
  id: z.string(),
});
export type DeleteStoreCreditRequest = z.infer<typeof deleteStoreCreditRequestSchema>;
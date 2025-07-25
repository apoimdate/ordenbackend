import { z } from 'zod';

export const findManyWalletRequestSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});
export type FindManyWalletRequest = z.infer<typeof findManyWalletRequestSchema>;

export const findWalletByIdRequestSchema = z.object({
  id: z.string(),
});
export type FindWalletByIdRequest = z.infer<typeof findWalletByIdRequestSchema>;

export const createWalletRequestSchema = z.object({
  userId: z.string(),
  currency: z.string(),
});
export type CreateWalletRequest = z.infer<typeof createWalletRequestSchema>;

export const updateWalletRequestSchema = z.object({
  isActive: z.boolean().optional(),
});
export type UpdateWalletRequest = z.infer<typeof updateWalletRequestSchema>;

export const deleteWalletRequestSchema = z.object({
  id: z.string(),
});
export type DeleteWalletRequest = z.infer<typeof deleteWalletRequestSchema>;
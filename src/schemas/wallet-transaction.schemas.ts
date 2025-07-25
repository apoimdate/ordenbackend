import { z } from 'zod';

export const findManyWalletTransactionRequestSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});
export type FindManyWalletTransactionRequest = z.infer<typeof findManyWalletTransactionRequestSchema>;

export const findWalletTransactionByIdRequestSchema = z.object({
  id: z.string(),
});
export type FindWalletTransactionByIdRequest = z.infer<typeof findWalletTransactionByIdRequestSchema>;

export const createWalletTransactionRequestSchema = z.object({
  walletId: z.string(),
  amount: z.number(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'PURCHASE', 'REFUND', 'ADJUSTMENT']),
  description: z.string(),
});
export type CreateWalletTransactionRequest = z.infer<typeof createWalletTransactionRequestSchema>;

export const updateWalletTransactionRequestSchema = z.object({
  description: z.string().optional(),
});
export type UpdateWalletTransactionRequest = z.infer<typeof updateWalletTransactionRequestSchema>;

export const deleteWalletTransactionRequestSchema = z.object({
  id: z.string(),
});
export type DeleteWalletTransactionRequest = z.infer<typeof deleteWalletTransactionRequestSchema>;
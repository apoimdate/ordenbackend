
import { z } from 'zod';

export const createWalletTransactionSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  type: z.string(),
  description: z.string(),
});

export const findManyWalletTransactionSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const findWalletTransactionByIdSchema = z.object({
  id: z.string().uuid(),
});

export const updateWalletTransactionSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
});

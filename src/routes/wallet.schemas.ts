
import { z } from 'zod';

export const createWalletSchema = z.object({
  user: z.object({
    connect: z.object({
      id: z.string().uuid(),
    }),
  }),
  balance: z.number().positive(),
  currency: z.string().length(3),
});

export const findManyWalletSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const findWalletByIdSchema = z.object({
  id: z.string().uuid(),
});

export const updateWalletSchema = z.object({
  balance: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
});

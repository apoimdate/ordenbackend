
import { z } from 'zod';

export const createGiftCardSchema = z.object({
  code: z.string(),
  balance: z.number().positive(),
  currency: z.string().length(3),
  expiresAt: z.string().datetime().optional(),
});

export const giftCardQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const giftCardParamsSchema = z.object({
  id: z.string().uuid(),
});

export const updateGiftCardSchema = z.object({
  balance: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

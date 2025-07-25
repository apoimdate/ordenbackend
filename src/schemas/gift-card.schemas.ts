import { z } from 'zod';
import { Currency } from '@prisma/client';

export const createGiftCardSchema = z.object({
  code: z.string(),
  initialAmount: z.number(),
  currentBalance: z.number(),
  currency: z.nativeEnum(Currency),
  expiresAt: z.union([z.string().datetime(), z.date()]),
  recipientEmail: z.string().email().optional(),
  message: z.string().optional(),
  purchasedBy: z.string(),
});

export const updateGiftCardSchema = z.object({
  amount: z.number().optional(),
  currency: z.nativeEnum(Currency).optional(),
  expiresAt: z.union([z.string().datetime(), z.date()]),
  recipientEmail: z.string().email().optional(),
  message: z.string().optional(),
});

export const giftCardParamsSchema = z.object({
  id: z.string(),
});

export const giftCardQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
});

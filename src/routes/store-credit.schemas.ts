
import { z } from 'zod';

export const createStoreCreditSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export const findManyStoreCreditSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const findStoreCreditByIdSchema = z.object({
  id: z.string().uuid(),
});

export const updateStoreCreditSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

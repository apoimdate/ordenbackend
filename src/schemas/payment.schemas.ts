import { z } from 'zod';
import { PaymentMethod, Currency } from '@prisma/client';

export const createPaymentSchema = z.object({
  body: z.object({
    orderId: z.string(),
    method: z.nativeEnum(PaymentMethod),
    amount: z.number(),
    currency: z.nativeEnum(Currency),
    paymentMethodId: z.string().optional(),
    walletId: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const updatePaymentSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
  }),
});

export const getPaymentSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const getPaymentsSchema = z.object({
  querystring: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

export const deletePaymentSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

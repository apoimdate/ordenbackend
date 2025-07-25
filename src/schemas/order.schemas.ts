import { z } from 'zod';
import { OrderStatus, PaymentStatus, Currency, ShippingMethod } from '@prisma/client';

export const createOrderSchema = z.object({
  body: z.object({
    userId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1),
        price: z.number().optional(),
      })
    ),
    shippingAddressId: z.string().optional(),
    pickupLocationId: z.string().optional(),
    shippingMethod: z.nativeEnum(ShippingMethod),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
    currency: z.nativeEnum(Currency).optional(),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  }),
});

export const getOrderSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const getOrdersSchema = z.object({
  querystring: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

export const deleteOrderSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

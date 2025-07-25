import { z } from 'zod';

export const findManyCartSchema = {
  querystring: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
};

export const findCartByIdSchema = {
  params: z.object({
    id: z.string(),
  }),
};

export const createCartSchema = {
  body: z.object({
    userId: z.string(),
  }),
};

export const updateCartSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    // Add properties to update here
  }),
};

export const deleteCartRequestSchema = {
  params: z.object({
    id: z.string(),
  }),
};

import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    productId: z.string(),
    rating: z.number().int().min(1).max(5),
    title: z.string().min(1).max(255),
    comment: z.string().max(1000),
  }),
});

export const updateReviewSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().min(1).max(255).optional(),
    comment: z.string().max(1000).optional(),
  }),
});

export const getReviewSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const getReviewsSchema = z.object({
  querystring: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  }),
});

export const deleteReviewSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

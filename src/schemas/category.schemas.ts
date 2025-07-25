import { z } from 'zod';

export const findManyCategorySchema = {
  querystring: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
};

export const findCategoryByIdSchema = {
  params: z.object({
    id: z.string(),
  }),
};

export const createCategorySchema = {
  body: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
};

export const updateCategorySchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  }),
};

export const deleteCategoryRequestSchema = {
  params: z.object({
    id: z.string(),
  }),
};

import { z } from 'zod';

export const findManyCmsSchema = {
  querystring: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
};

export const findCmsByIdSchema = {
  params: z.object({
    id: z.string(),
  }),
};

export const createCmsSchema = {
  body: z.object({
    title: z.string(),
    slug: z.string(),
    content: z.string(),
    isPublished: z.boolean().optional(),
  }),
};

export const updateCmsSchema = {
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    title: z.string().optional(),
    slug: z.string().optional(),
    content: z.string().optional(),
    isPublished: z.boolean().optional(),
  }),
};

export const deleteCmsRequestSchema = {
  params: z.object({
    id: z.string(),
  }),
};

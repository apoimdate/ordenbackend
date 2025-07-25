import { z } from 'zod';

export const getSellersSchema = {
  querystring: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
    search: z.string().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  }),
};

export const getSellerSchema = {
  params: z.object({
    id: z.string(),
  }),
};

export const createSellerSchema = {
  body: z.object({
    businessName: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    contactEmail: z.string().email(),
    contactPhone: z.string(),
    businessType: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
    taxId: z.string().optional(),
    currency: z.string().default('USD'),
  }),
};

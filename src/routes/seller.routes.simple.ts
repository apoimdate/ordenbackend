import { FastifyInstance, FastifyRequest } from 'fastify';
import { SellerService } from '../services/seller.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createSellerSchema,
  getSellerSchema,
  getSellersSchema,
} from '../schemas/seller.schemas';
import { z } from 'zod';

export default async function sellerRoutes(fastify: FastifyInstance) {
  const sellerService = new SellerService(fastify);

  fastify.get(
    '/',
    { schema: getSellersSchema },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof getSellersSchema.querystring> }>,
      reply
    ) => {
      const { page, limit, search, status } = request.query;
      const result = await sellerService.findMany({
        page: Number(page),
        limit: Number(limit),
        search,
        status,
      });

      if (!result.success || !result.data) {
        return reply.status(500).send(result);
      }

      return reply.send({
        success: true,
        message:
          result.data.data.length > 0
            ? 'Data retrieved successfully'
            : 'No data available',
        data: result.data.data || [],
        pagination: {
          page: result.data.meta.page,
          limit: result.data.meta.limit,
          total: result.data.meta.total,
          pages: result.data.meta.totalPages,
        },
      });
    }
  );

  fastify.get(
    '/:id',
    { schema: getSellerSchema },
    async (
      request: FastifyRequest<{ Params: z.infer<typeof getSellerSchema.params> }>,
      reply
    ) => {
      const { id } = request.params;
      const result = await sellerService.findById(id);

      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.post(
    '/',
    {
      schema: createSellerSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof createSellerSchema.body> }>,
      reply
    ) => {
      const result = await sellerService.create({
        ...request.body,
        userId: (request as any).user.userId,
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(201).send(result);
    }
  );
}

import { FastifyInstance, FastifyRequest } from 'fastify';
import { ReviewService } from '../services/review.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createReviewSchema,
  deleteReviewSchema,
  getReviewSchema,
  getReviewsSchema,
  updateReviewSchema,
} from '../schemas/review.schemas';
import { z } from 'zod';

export default async function reviewRoutes(fastify: FastifyInstance) {
  const reviewService = new ReviewService(fastify);

  fastify.get(
    '/',
    { schema: getReviewsSchema },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof getReviewsSchema>['querystring'] }>,
      reply
    ) => {
      const { page, limit, search } = request.query;
      const result = await reviewService.findMany({
        page,
        limit,
        search,
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
    { schema: getReviewSchema },
    async (
      request: FastifyRequest<{ Params: z.infer<typeof getReviewSchema>['params'] }>,
      reply
    ) => {
      const { id } = request.params;
      const result = await reviewService.findById(id);

      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.post(
    '/',
    {
      schema: createReviewSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof createReviewSchema>['body'] }>,
      reply
    ) => {
      const userId = request.user!.userId;
      const result = await reviewService.create({ ...request.body, userId });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(201).send(result);
    }
  );

  fastify.put(
    '/:id',
    {
      schema: updateReviewSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof updateReviewSchema>['params'];
        Body: z.infer<typeof updateReviewSchema>['body'];
      }>,
      reply
    ) => {
      const { id } = request.params;
      const result = await reviewService.update(id, request.body);

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.delete(
    '/:id',
    {
      schema: deleteReviewSchema,
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    },
    async (
      request: FastifyRequest<{ Params: z.infer<typeof deleteReviewSchema>['params'] }>,
      reply
    ) => {
      const { id } = request.params;
      const result = await reviewService.delete(id);

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(204).send();
    }
  );
}

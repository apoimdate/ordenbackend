import { FastifyInstance, FastifyRequest } from 'fastify';
import { LoyaltyService } from '../services/loyalty.service';
import {
  createLoyaltySchema,
  getLoyaltySchema,
  getLoyaltysSchema,
} from '../schemas/loyalty.schemas';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';

export default async function loyaltyRoutes(fastify: FastifyInstance) {
  const loyaltyService = new LoyaltyService(fastify);

  fastify.get(
    '/',
    {
      schema: getLoyaltysSchema,
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof getLoyaltysSchema>['querystring'] }>,
      reply
    ) => {
      const result = await loyaltyService.findMany(request.query);
      return reply.send(result);
    }
  );

  fastify.get(
    '/:id',
    {
      schema: getLoyaltySchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof getLoyaltySchema>['params'];
      const result = await loyaltyService.findById(id);

      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.post(
    '/',
    {
      schema: createLoyaltySchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const { userId, points } = request.body as z.infer<
        typeof createLoyaltySchema
      >['body'];
      const result = await loyaltyService.create({
        user: {
          connect: {
            id: userId,
          },
        },
        points,
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(201).send(result);
    }
  );
}

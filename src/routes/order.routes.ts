import { FastifyInstance, FastifyRequest } from 'fastify';
import { OrderService } from '../services/order.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createOrderSchema,
  deleteOrderSchema,
  getOrderSchema,
  getOrdersSchema,
  updateOrderSchema,
} from '../schemas/order.schemas';
import { z } from 'zod';

export default async function orderRoutes(fastify: FastifyInstance) {
  const orderService = new OrderService(fastify);

  fastify.get(
    '/',
    {
      schema: getOrdersSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof getOrdersSchema>['querystring'] }>,
      reply
    ) => {
      const result = await orderService.findMany(request.query);
      return reply.send(result);
    }
  );

  fastify.get(
    '/:id',
    {
      schema: getOrderSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof getOrderSchema>['params'];
      const result = await orderService.findById(id);

      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.post(
    '/',
    {
      schema: createOrderSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const result = await orderService.create(
        request.body as z.infer<typeof createOrderSchema>['body']
      );

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(201).send(result);
    }
  );

  fastify.put(
    '/:id',
    {
      schema: updateOrderSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof updateOrderSchema>['params'];
      const result = await orderService.update(id, {
        ...(request.body as z.infer<typeof updateOrderSchema>['body']),
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.delete(
    '/:id',
    {
      schema: deleteOrderSchema,
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof deleteOrderSchema>['params'];
      const result = await orderService.delete(id);

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(204).send();
    }
  );
}


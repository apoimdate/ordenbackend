import { FastifyInstance } from 'fastify';
import { CartService } from '../services/cart.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createCartSchema,
  findManyCartSchema,
  findCartByIdSchema,
  updateCartSchema,
  deleteCartRequestSchema,
} from '../schemas/cart.schemas';
import { z } from 'zod';

export default async function cartRoutes(fastify: FastifyInstance) {
  const cartService = new CartService(fastify);

  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: findManyCartSchema,
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as z.infer<typeof findManyCartSchema.querystring>;
      const result = await cartService.findMany({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
      });

      if (result.success) {
        return reply.send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: findCartByIdSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findCartByIdSchema.params>;
      const result = await cartService.findById(id);

      if (result.success) {
        if (result.data) {
          return reply.send(result.data);
        } else {
          return reply.code(404).send({ message: 'Cart not found' });
        }
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])],
      schema: createCartSchema,
    },
    async (request, reply) => {
      const result = await cartService.createCart(request.body as z.infer<typeof createCartSchema.body>);

      if (result.success) {
        return reply.code(201).send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])],
      schema: updateCartSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof updateCartSchema.params>;
      const result = await cartService.update(id, request.body as z.infer<typeof updateCartSchema.body>);

      if (result.success) {
        return reply.send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: deleteCartRequestSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof deleteCartRequestSchema.params>;
      const result = await cartService.delete(id);

      if (result.success) {
        return reply.code(204).send();
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );
}



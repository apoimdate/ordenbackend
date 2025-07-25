import { FastifyInstance } from 'fastify';
import { WalletService } from '../services/wallet.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createWalletRequestSchema,
  findManyWalletRequestSchema,
  findWalletByIdRequestSchema,
  updateWalletRequestSchema,
} from '../schemas/wallet.schema';
import { z } from 'zod';


export default async function walletRoutes(fastify: FastifyInstance) {
  const walletService = new WalletService(fastify);

  // Get all wallets
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: findManyWalletRequestSchema,
      },
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as z.infer<typeof findManyWalletRequestSchema>;
      const result = await walletService.findMany({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
      });

      return reply.send(result);
    },
  );

  // Get wallet by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: findWalletByIdRequestSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findWalletByIdRequestSchema>;
      const result = await walletService.findById(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Create wallet
  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createWalletRequestSchema,
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createWalletRequestSchema>;
      const { userId, currency } = body;
      const result = await walletService.create({
        user: {
          connect: {
            id: userId,
          },
        },
        currency,
      } as any);

      return reply.code(201).send(result);
    },
  );

  // Update wallet
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: findWalletByIdRequestSchema,
        body: updateWalletRequestSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findWalletByIdRequestSchema>;
      const result = await walletService.update(id, request.body as z.infer<typeof updateWalletRequestSchema>);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Delete wallet
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: findWalletByIdRequestSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findWalletByIdRequestSchema>;
      const result = await walletService.delete(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(204).send();
    },
  );
}

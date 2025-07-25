import { FastifyInstance } from 'fastify';
import { WalletTransactionService } from '../services/wallet-transaction.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createWalletTransactionRequestSchema,
  findManyWalletTransactionRequestSchema,
  findWalletTransactionByIdRequestSchema,
  updateWalletTransactionRequestSchema,
} from '../schemas/wallet-transaction.schemas';
import { z } from 'zod';


export default async function wallettransactionRoutes(fastify: FastifyInstance) {
  const walletTransactionService = new WalletTransactionService(fastify);

  // Get all walletTransactions
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: findManyWalletTransactionRequestSchema,
      },
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as z.infer<typeof findManyWalletTransactionRequestSchema>;
      const result = await walletTransactionService.findMany({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
      });

      return reply.send(result);
    },
  );

  // Get walletTransaction by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: findWalletTransactionByIdRequestSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findWalletTransactionByIdRequestSchema>;
      const result = await walletTransactionService.findById(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Create walletTransaction
  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createWalletTransactionRequestSchema,
      },
    },
    async (request, reply) => {
      const result = await walletTransactionService.create(request.body as any);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(201).send(result);
    },
  );

  // Update walletTransaction
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: findWalletTransactionByIdRequestSchema,
        body: updateWalletTransactionRequestSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findWalletTransactionByIdRequestSchema>;
      const result = await walletTransactionService.update(id, request.body as z.infer<typeof updateWalletTransactionRequestSchema>);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Delete walletTransaction
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: findWalletTransactionByIdRequestSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findWalletTransactionByIdRequestSchema>;
      const result = await walletTransactionService.delete(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(204).send();
    },
  );
}
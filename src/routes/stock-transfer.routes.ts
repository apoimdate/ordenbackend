import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StockTransferService } from '../services/stock-transfer.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createStockTransferRequestSchema,
  findManyStockTransferRequestSchema,
  findStockTransferByIdRequestSchema,
  updateStockTransferRequestSchema,
  deleteStockTransferRequestSchema,
} from '../schemas/stock-transfer.schemas';

export default async function stocktransferRoutes(fastify: FastifyInstance) {
  const stockTransferService = new StockTransferService(fastify);

  // Get all stockTransfers
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: findManyStockTransferRequestSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { page, limit, search } = request.query as any;
      const result = await stockTransferService.findMany({
        page: page ? parseInt(page as any) : undefined,
        limit: limit ? parseInt(limit as any) : undefined,
        search,
      });

      return reply.send(result);
    },
  );

  // Get stockTransfer by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: findStockTransferByIdRequestSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = request.params as any;
      const result = await stockTransferService.findById(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Create stockTransfer
  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: createStockTransferRequestSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const result = await stockTransferService.create(request.body as any);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(201).send(result);
    },
  );

  // Update stockTransfer
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: updateStockTransferRequestSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = request.params as any;
      const result = await stockTransferService.update(id, request.body as any);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Delete stockTransfer
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: deleteStockTransferRequestSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = request.params as any;
      const result = await stockTransferService.delete(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(204).send();
    },
  );
}

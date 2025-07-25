import { FastifyInstance } from 'fastify';
import { StockLocationService } from '../services/stock-locations.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createStockLocationSchema,
  findManyStockLocationSchema,
  findStockLocationByIdSchema,
  updateStockLocationSchema,
  deleteStockLocationRequestSchema,
} from '../schemas/stock-locations.schemas';

export default async function stocklocationsRoutes(fastify: FastifyInstance) {
  const stockLocationService = new StockLocationService(fastify);

  // Get all stockLocations
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: findManyStockLocationSchema,
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as any;
      const result = await stockLocationService.findMany({
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

  // Get stockLocation by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: findStockLocationByIdSchema,
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const result = await stockLocationService.findById(id);

      if (result.success) {
        if (result.data) {
          return reply.send(result.data);
        } else {
          return reply.code(404).send({ message: 'Stock location not found' });
        }
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  // Create stockLocation
  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: createStockLocationSchema,
    },
    async (request, reply) => {
      const result = await stockLocationService.create(request.body as any);

      if (result.success) {
        return reply.code(201).send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  // Update stockLocation
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: updateStockLocationSchema,
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const result = await stockLocationService.update(id, request.body as any);

      if (result.success) {
        return reply.send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  // Delete stockLocation
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: deleteStockLocationRequestSchema,
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const result = await stockLocationService.delete(id);

      if (result.success) {
        return reply.code(204).send();
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );
}

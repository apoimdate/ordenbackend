import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StoreCreditService } from '../services/store-credit.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createStoreCreditRequestSchema,
  findManyStoreCreditRequestSchema,
  findStoreCreditByIdRequestSchema,
  updateStoreCreditRequestSchema,
} from '../schemas/store-credit.schemas';



export default async function storecreditRoutes(fastify: FastifyInstance) {
  const storeCreditService = new StoreCreditService(fastify);

  // Get all storeCredits
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: findManyStoreCreditRequestSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { page, limit, search } = request.query as any;
      const result = await storeCreditService.findMany({
        page: page ? parseInt(page as any) : undefined,
        limit: limit ? parseInt(limit as any) : undefined,
        search,
      });

      return reply.send(result);
    },
  );

  // Get storeCredit by ID
  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: findStoreCreditByIdRequestSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = request.params as any;
      const result = await storeCreditService.findById(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Create storeCredit
  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createStoreCreditRequestSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const result = await storeCreditService.create(request.body as any);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(201).send(result);
    },
  );

  // Update storeCredit
  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: findStoreCreditByIdRequestSchema,
        body: updateStoreCreditRequestSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = request.params as any;
      const result = await storeCreditService.update(id, request.body as any);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.send(result);
    },
  );

  // Delete storeCredit
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: findStoreCreditByIdRequestSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = request.params as any;
      const result = await storeCreditService.delete(id);

      if (!result.success) {
        return reply.code(result.error?.statusCode || 500).send(result);
      }

      return reply.code(204).send();
    },
  );
}
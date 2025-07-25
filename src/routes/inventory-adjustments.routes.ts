import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createInventoryAdjustmentSchema,
  updateInventoryAdjustmentSchema,
  inventoryAdjustmentParamsSchema,
  inventoryAdjustmentQuerySchema,
} from '../schemas/inventory-adjustments.schemas';
import { InventoryAdjustmentService } from '../services/inventory-adjustments.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { z } from 'zod';

type CreateInventoryAdjustmentRequest = FastifyRequest<{
  Body: z.infer<typeof createInventoryAdjustmentSchema>;
}>;

type GetInventoryAdjustmentsRequest = FastifyRequest<{
  Querystring: z.infer<typeof inventoryAdjustmentQuerySchema>;
}>;

type GetInventoryAdjustmentRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryAdjustmentParamsSchema>;
}>;

type UpdateInventoryAdjustmentRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryAdjustmentParamsSchema>;
  Body: z.infer<typeof updateInventoryAdjustmentSchema>;
}>;

type DeleteInventoryAdjustmentRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryAdjustmentParamsSchema>;
}>;

export default async function inventoryAdjustmentsRoutes(
  fastify: FastifyInstance
) {
  const inventoryAdjustmentService = new InventoryAdjustmentService(fastify);

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createInventoryAdjustmentSchema,
      },
    },
    async (request: CreateInventoryAdjustmentRequest, reply) => {
      const inventoryAdjustment = await inventoryAdjustmentService.create(
        request.body
      );
      reply.code(201).send(inventoryAdjustment);
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: inventoryAdjustmentQuerySchema,
      },
    },
    async (request: GetInventoryAdjustmentsRequest, reply) => {
      const result = await inventoryAdjustmentService.findMany(
        request.query
      );
      reply.send(result);
    }
  );

  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: inventoryAdjustmentParamsSchema,
      },
    },
    async (request: GetInventoryAdjustmentRequest, reply) => {
      const inventoryAdjustment = await inventoryAdjustmentService.findById(
        request.params.id
      );
      if (!inventoryAdjustment) {
        reply.code(404).send({ message: 'Inventory adjustment not found' });
      } else {
        reply.send(inventoryAdjustment);
      }
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: inventoryAdjustmentParamsSchema,
        body: updateInventoryAdjustmentSchema,
      },
    },
    async (request: UpdateInventoryAdjustmentRequest, reply) => {
      const inventoryAdjustment = await inventoryAdjustmentService.update(
        request.params.id,
        request.body
      );
      reply.send(inventoryAdjustment);
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: inventoryAdjustmentParamsSchema,
      },
    },
    async (request: DeleteInventoryAdjustmentRequest, reply) => {
      await inventoryAdjustmentService.delete(request.params.id);
      reply.code(204).send();
    }
  );
}

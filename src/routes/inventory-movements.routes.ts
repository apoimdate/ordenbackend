import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createInventoryMovementSchema,
  updateInventoryMovementSchema,
  inventoryMovementParamsSchema,
  inventoryMovementQuerySchema,
} from '../schemas/inventory-movements.schemas';
import { InventoryMovementService } from '../services/inventory-movements.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { z } from 'zod';

type CreateInventoryMovementRequest = FastifyRequest<{
  Body: z.infer<typeof createInventoryMovementSchema>;
}>;

type GetInventoryMovementsRequest = FastifyRequest<{
  Querystring: z.infer<typeof inventoryMovementQuerySchema>;
}>;

type GetInventoryMovementRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryMovementParamsSchema>;
}>;

type UpdateInventoryMovementRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryMovementParamsSchema>;
  Body: z.infer<typeof updateInventoryMovementSchema>;
}>;

type DeleteInventoryMovementRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryMovementParamsSchema>;
}>;

export default async function inventoryMovementsRoutes(
  fastify: FastifyInstance
) {
  const inventoryMovementService = new InventoryMovementService(fastify);

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createInventoryMovementSchema,
      },
    },
    async (request: CreateInventoryMovementRequest, reply) => {
      const inventoryMovement = await inventoryMovementService.create(
        request.body
      );
      reply.code(201).send(inventoryMovement);
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: inventoryMovementQuerySchema,
      },
    },
    async (request: GetInventoryMovementsRequest, reply) => {
      const result = await inventoryMovementService.findMany(
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
        params: inventoryMovementParamsSchema,
      },
    },
    async (request: GetInventoryMovementRequest, reply) => {
      const inventoryMovement = await inventoryMovementService.findById(
        request.params.id
      );
      if (!inventoryMovement) {
        reply.code(404).send({ message: 'Inventory movement not found' });
      } else {
        reply.send(inventoryMovement);
      }
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: inventoryMovementParamsSchema,
        body: updateInventoryMovementSchema,
      },
    },
    async (request: UpdateInventoryMovementRequest, reply) => {
      const inventoryMovement = await inventoryMovementService.update(
        request.params.id,
        request.body
      );
      reply.send(inventoryMovement);
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: inventoryMovementParamsSchema,
      },
    },
    async (request: DeleteInventoryMovementRequest, reply) => {
      await inventoryMovementService.delete(request.params.id);
      reply.code(204).send();
    }
  );
}

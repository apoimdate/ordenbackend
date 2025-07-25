import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryItemParamsSchema,
  inventoryItemQuerySchema,
} from '../schemas/inventory-items.schemas';
import { InventoryItemService } from '../services/inventory-items.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { z } from 'zod';

type CreateInventoryItemRequest = FastifyRequest<{
  Body: z.infer<typeof createInventoryItemSchema>;
}>;

type GetInventoryItemsRequest = FastifyRequest<{
  Querystring: z.infer<typeof inventoryItemQuerySchema>;
}>;

type GetInventoryItemRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryItemParamsSchema>;
}>;

type UpdateInventoryItemRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryItemParamsSchema>;
  Body: z.infer<typeof updateInventoryItemSchema>;
}>;

type DeleteInventoryItemRequest = FastifyRequest<{
  Params: z.infer<typeof inventoryItemParamsSchema>;
}>;

export default async function inventoryItemsRoutes(fastify: FastifyInstance) {
  const inventoryItemService = new InventoryItemService(fastify);

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createInventoryItemSchema,
      },
    },
    async (request: CreateInventoryItemRequest, reply) => {
      const inventoryItem = await inventoryItemService.create({
        product: { connect: { id: request.body.productId } },
        location: { connect: { id: request.body.stockLocationId } },
        quantity: request.body.quantity
      });
      reply.code(201).send(inventoryItem);
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: inventoryItemQuerySchema,
      },
    },
    async (request: GetInventoryItemsRequest, reply) => {
      const result = await inventoryItemService.findMany(request.query);
      reply.send(result);
    }
  );

  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: inventoryItemParamsSchema,
      },
    },
    async (request: GetInventoryItemRequest, reply) => {
      const inventoryItem = await inventoryItemService.findById(
        request.params.id
      );
      if (!inventoryItem) {
        reply.code(404).send({ message: 'Inventory item not found' });
      } else {
        reply.send(inventoryItem);
      }
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: inventoryItemParamsSchema,
        body: updateInventoryItemSchema,
      },
    },
    async (request: UpdateInventoryItemRequest, reply) => {
      const inventoryItem = await inventoryItemService.update(
        request.params.id,
        request.body
      );
      reply.send(inventoryItem);
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: inventoryItemParamsSchema,
      },
    },
    async (request: DeleteInventoryItemRequest, reply) => {
      await inventoryItemService.delete(request.params.id);
      reply.code(204).send();
    }
  );
}

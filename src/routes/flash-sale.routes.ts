import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createFlashSaleSchema,
  updateFlashSaleSchema,
  flashSaleParamsSchema,
  flashSaleQuerySchema,
} from '../schemas/flash-sale.schemas';
import { FlashSaleService } from '../services/flash-sale.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { z } from 'zod';

type CreateFlashSaleRequest = FastifyRequest<{
  Body: z.infer<typeof createFlashSaleSchema>;
}>;

type UpdateFlashSaleRequest = FastifyRequest<{
  Body: z.infer<typeof updateFlashSaleSchema>;
  Params: z.infer<typeof flashSaleParamsSchema>;
}>;

type GetFlashSaleRequest = FastifyRequest<{
  Params: z.infer<typeof flashSaleParamsSchema>;
}>;

type GetFlashSalesRequest = FastifyRequest<{
  Querystring: z.infer<typeof flashSaleQuerySchema>;
}>;


export default async function flashSaleRoutes(fastify: FastifyInstance) {
  const flashSaleService = new FlashSaleService(fastify);

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createFlashSaleSchema,
      },
    },
    async (
      request: CreateFlashSaleRequest,
      reply
    ) => {
      const flashSale = await flashSaleService.create(request.body);
      reply.code(201).send(flashSale);
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: flashSaleQuerySchema,
      },
    },
    async (
      request: GetFlashSalesRequest,
      reply
    ) => {
      const flashSales = await flashSaleService.findMany(request.query as any);
      reply.send(flashSales);
    }
  );

  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: flashSaleParamsSchema,
      },
    },
    async (request: GetFlashSaleRequest, reply) => {
      const flashSale = await flashSaleService.findById(request.params.id);
      if (!flashSale) {
        reply.code(404).send({ message: 'Flash sale not found' });
      } else {
        reply.send(flashSale);
      }
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: flashSaleParamsSchema,
        body: updateFlashSaleSchema,
      },
    },
    async (
      request: UpdateFlashSaleRequest,
      reply
    ) => {
      const flashSale = await flashSaleService.update(
        request.params.id,
        request.body
      );
      reply.send(flashSale);
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: flashSaleParamsSchema,
      },
    },
    async (request: GetFlashSaleRequest, reply) => {
      await flashSaleService.delete(request.params.id);
      reply.code(204).send();
    }
  );
}

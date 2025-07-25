import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createGiftCardSchema,
  updateGiftCardSchema,
  giftCardParamsSchema,
  giftCardQuerySchema,
} from '../schemas/gift-card.schemas';
import { GiftCardService } from '../services/gift-card.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { z } from 'zod';

type CreateGiftCardRequest = FastifyRequest<{
  Body: z.infer<typeof createGiftCardSchema>;
}>;

type GetGiftCardsRequest = FastifyRequest<{
  Querystring: z.infer<typeof giftCardQuerySchema>;
}>;

type GetGiftCardRequest = FastifyRequest<{
  Params: z.infer<typeof giftCardParamsSchema>;
}>;

type UpdateGiftCardRequest = FastifyRequest<{
  Params: z.infer<typeof giftCardParamsSchema>;
  Body: z.infer<typeof updateGiftCardSchema>;
}>;

type DeleteGiftCardRequest = FastifyRequest<{
  Params: z.infer<typeof giftCardParamsSchema>;
}>;

export default async function giftCardRoutes(fastify: FastifyInstance) {
  const giftCardService = new GiftCardService(fastify);

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: createGiftCardSchema,
      },
    },
    async (request: CreateGiftCardRequest, reply) => {
      const { initialAmount, ...rest } = request.body;
      const giftCard = await giftCardService.create({
        ...rest,
        initialAmount: initialAmount,
        currentBalance: initialAmount,
      });
      reply.code(201).send(giftCard);
    }
  );

  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        querystring: giftCardQuerySchema,
      },
    },
    async (request: GetGiftCardsRequest, reply) => {
      const result = await giftCardService.findMany(request.query);
      reply.send(result);
    }
  );

  fastify.get(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: giftCardParamsSchema,
      },
    },
    async (request: GetGiftCardRequest, reply) => {
      const giftCard = await giftCardService.findById(request.params.id);
      if (!giftCard) {
        reply.code(404).send({ message: 'Gift card not found' });
      } else {
        reply.send(giftCard);
      }
    }
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: giftCardParamsSchema,
        body: updateGiftCardSchema,
      },
    },
    async (request: UpdateGiftCardRequest, reply) => {
      const giftCard = await giftCardService.update(
        request.params.id,
        request.body
      );
      reply.send(giftCard);
    }
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: giftCardParamsSchema,
      },
    },
    async (request: DeleteGiftCardRequest, reply) => {
      await giftCardService.delete(request.params.id);
      reply.code(204).send();
    }
  );
}

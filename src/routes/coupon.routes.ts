import { FastifyInstance, FastifyRequest } from 'fastify';
import { CouponService } from '../services/coupon.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createCouponSchema,
  deleteCouponSchema,
  getCouponSchema,
  getCouponsSchema,
  updateCouponSchema,
} from '../schemas/coupon.schemas';
import { z } from 'zod';

export default async function couponRoutes(fastify: FastifyInstance) {
  const couponService = new CouponService(fastify);

  fastify.get(
    '/',
    {
      schema: getCouponsSchema,
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof getCouponsSchema>['querystring'] }>,
      reply
    ) => {
      const result = await couponService.findMany(request.query);
      return reply.send(result);
    }
  );

  fastify.get(
    '/:id',
    {
      schema: getCouponSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof getCouponSchema>['params'];
      const result = await couponService.findById(id);

      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.post(
    '/',
    {
      schema: createCouponSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const result = await couponService.create({
        ...(request.body as z.infer<typeof createCouponSchema>['body']),
        userId: (request as any).user.userId,
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(201).send(result);
    }
  );

  fastify.put(
    '/:id',
    {
      schema: updateCouponSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof updateCouponSchema>['params'];
      const result = await couponService.update(
        id,
        request.body as z.infer<typeof updateCouponSchema>['body']
      );

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.send(result);
    }
  );

  fastify.delete(
    '/:id',
    {
      schema: deleteCouponSchema,
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof deleteCouponSchema>['params'];
      const result = await couponService.delete(id);

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(204).send();
    }
  );
}

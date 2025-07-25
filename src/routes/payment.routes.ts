import { FastifyInstance } from 'fastify';
import { PaymentService } from '../services/payment.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createPaymentSchema,
  getPaymentsSchema,
} from '../schemas/payment.schemas';
import { z } from 'zod';

export default async function paymentRoutes(fastify: FastifyInstance) {
  const paymentService = new PaymentService(fastify);

  fastify.get(
    '/',
    {
      schema: getPaymentsSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as z.infer<
        typeof getPaymentsSchema
      >['querystring'];
      const result = await paymentService.searchPayments({
        page,
        limit,
        search,
      });

      if (!result.success || !result.data) {
        return reply.status(500).send(result);
      }

      return reply.send({
        success: true,
        message:
          result.data.data.length > 0
            ? 'Data retrieved successfully'
            : 'No data available',
        data: result.data.data || [],
        pagination: {
          page: result.data.meta.page,
          limit: result.data.meta.limit,
          total: result.data.meta.total,
          pages: result.data.meta.totalPages,
        },
      });
    }
  );

  fastify.post(
    '/',
    {
      schema: createPaymentSchema,
      preHandler: [
        authenticate,
        authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
      ],
    },
    async (request, reply) => {
      const result = await paymentService.createPayment(
        request.body as z.infer<typeof createPaymentSchema>['body']
      );

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.status(201).send(result);
    }
  );
}


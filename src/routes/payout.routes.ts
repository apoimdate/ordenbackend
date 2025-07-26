import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PayoutService, CreatePayoutData, PayoutSearchParams } from '../services/payout.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';

// Request type definitions
type CreatePayoutRequest = FastifyRequest<{ Body: CreatePayoutData }>;
type GetPayoutRequest = FastifyRequest<{ Params: { id: string } }>;
type SearchPayoutsRequest = FastifyRequest<{ Querystring: PayoutSearchParams }>;
type ProcessPayoutRequest = FastifyRequest<{ Params: { id: string } }>;
type CancelPayoutRequest = FastifyRequest<{ 
  Params: { id: string }; 
  Body: { reason?: string } 
}>;
type GetSellerPayoutsRequest = FastifyRequest<{ 
  Params: { sellerId: string }; 
  Querystring: PayoutSearchParams 
}>;

const payoutRoutes: FastifyPluginAsync = async (fastify) => {
  const payoutService = new PayoutService(fastify);

  // Create payout
  fastify.post<{ Body: CreatePayoutData }>(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        body: {
          type: 'object',
          required: ['sellerId', 'amount', 'method'],
          properties: {
            sellerId: { type: 'string' },
            amount: { type: 'number', minimum: 0.01 },
            currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
            method: { type: 'string' },
            reference: { type: 'string' }
          }
        }
      }
    },
    async (request: CreatePayoutRequest, reply) => {
      const result = await payoutService.createPayout(request.body);
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.status(201).send({
        success: true,
        data: result.data
      });
    }
  );

  // Get payout by ID
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'SELLER'])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async (request: GetPayoutRequest, reply) => {
      const result = await payoutService.getById(request.params.id);
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.send({
        success: true,
        data: result.data
      });
    }
  );

  // Search payouts
  fastify.get<{ Querystring: PayoutSearchParams }>(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            sellerId: { type: 'string' },
            status: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            method: { type: 'string' },
            minAmount: { type: 'number' },
            maxAmount: { type: 'number' },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            sortBy: { 
              type: 'string', 
              enum: ['newest', 'oldest', 'amount_asc', 'amount_desc'] 
            }
          }
        }
      }
    },
    async (request: SearchPayoutsRequest, reply) => {
      const params = { ...request.query };
      
      // Convert date strings to Date objects
      if (params.dateFrom) params.dateFrom = new Date(params.dateFrom as any);
      if (params.dateTo) params.dateTo = new Date(params.dateTo as any);

      const result = await payoutService.search(params);
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.send({
        success: true,
        data: result.data
      });
    }
  );

  // Process payout
  fastify.post<{ Params: { id: string } }>(
    '/:id/process',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async (request: ProcessPayoutRequest, reply) => {
      const result = await payoutService.processPayout(request.params.id);
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.send({
        success: true,
        data: result.data
      });
    }
  );

  // Cancel payout
  fastify.post<{ 
    Params: { id: string }; 
    Body: { reason?: string } 
  }>(
    '/:id/cancel',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' }
          }
        }
      }
    },
    async (request: CancelPayoutRequest, reply) => {
      const result = await payoutService.cancelPayout(
        request.params.id, 
        request.body.reason
      );
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.send({
        success: true,
        data: result.data
      });
    }
  );

  // Get seller payouts
  fastify.get<{ 
    Params: { sellerId: string }; 
    Querystring: PayoutSearchParams 
  }>(
    '/seller/:sellerId',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'SELLER'])],
      schema: {
        params: {
          type: 'object',
          required: ['sellerId'],
          properties: {
            sellerId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            sortBy: { 
              type: 'string', 
              enum: ['newest', 'oldest', 'amount_asc', 'amount_desc'] 
            }
          }
        }
      }
    },
    async (request: GetSellerPayoutsRequest, reply) => {
      const result = await payoutService.getSellerPayouts(
        request.params.sellerId,
        request.query
      );
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.send({
        success: true,
        data: result.data
      });
    }
  );

  // Get payout statistics
  fastify.get<{ 
    Querystring: { 
      sellerId?: string; 
      dateFrom?: string; 
      dateTo?: string; 
    } 
  }>(
    '/stats',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            sellerId: { type: 'string' },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' }
          }
        }
      }
    },
    async (request, reply) => {
      const { sellerId, dateFrom, dateTo } = request.query;
      
      const result = await payoutService.getPayoutStats(
        sellerId,
        dateFrom ? new Date(dateFrom) : undefined,
        dateTo ? new Date(dateTo) : undefined
      );
      
      if (!result.success) {
        return reply.status(result.error!.statusCode || 500).send({
          error: {
            code: result.error!.code,
            message: result.error!.message
          }
        });
      }

      reply.send({
        success: true,
        data: result.data
      });
    }
  );
};

export default payoutRoutes;
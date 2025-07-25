import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { PayoutService } from '../services/payout.service';
import { PayoutMethod, PayoutStatus } from '../utils/constants';
import { Currency } from '@prisma/client';
import { z } from 'zod';

// Request schemas
const RequestPayoutSchema = z.object({
  amount: z.number().positive(),
  currency: z.nativeEnum(Currency),
  method: z.nativeEnum(PayoutMethod),
  bankDetails: z.object({
    accountNumber: z.string(),
    routingNumber: z.string(),
    accountName: z.string(),
    bankName: z.string()
  }).optional(),
  paypalEmail: z.string().email().optional(),
  notes: z.string().optional()
});

const PayoutHistoryQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  status: z.nativeEnum(PayoutStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

const AdminPayoutQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  status: z.nativeEnum(PayoutStatus).optional(),
  sellerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

const ProcessPayoutSchema = z.object({
  transactionId: z.string().optional(),
  notes: z.string().optional()
});

type RequestPayoutBody = z.infer<typeof RequestPayoutSchema>;
type PayoutHistoryQuery = z.infer<typeof PayoutHistoryQuerySchema>;
type AdminPayoutQuery = z.infer<typeof AdminPayoutQuerySchema>;
type ProcessPayoutBody = z.infer<typeof ProcessPayoutSchema>;

const payoutRoutes: FastifyPluginAsync = async (fastify) => {
  const payoutService = new PayoutService(fastify);

  // Request a payout (Sellers only)
  fastify.post<{ Body: RequestPayoutBody }>(
    '/payouts/request',
    {
      preHandler: [authenticate, requireRole('SELLER')],
      schema: {
        body: RequestPayoutSchema,
        tags: ['Payouts'],
        summary: 'Request a new payout',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sellerId = (request as any).user.sellerId;
      if (!sellerId) {
        return reply.code(403).send({ error: 'User is not a seller' });
      }

      const result = await payoutService.requestPayout({
        ...(request.body as any),
        sellerId
      });
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.code(201).send(result.data);
    }
  );

  // Get payout history (Sellers)
  fastify.get<{ Querystring: PayoutHistoryQuery }>(
    '/payouts/history',
    {
      preHandler: [authenticate, requireRole('SELLER')],
      schema: {
        querystring: PayoutHistoryQuerySchema,
        tags: ['Payouts'],
        summary: 'Get seller payout history',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sellerId = (request as any).user.sellerId;
      if (!sellerId) {
        return reply.code(403).send({ error: 'User is not a seller' });
      }

      const result = await payoutService.getPayoutHistory(sellerId, (request.query as any));
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );

  // Get payout details (Sellers)
  fastify.get<{ Params: { payoutId: string } }>(
    '/payouts/:payoutId',
    {
      preHandler: [authenticate, requireRole('SELLER')],
      schema: {
        params: z.object({ payoutId: z.string() }),
        tags: ['Payouts'],
        summary: 'Get payout details',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sellerId = (request as any).user.sellerId;
      if (!sellerId) {
        return reply.code(403).send({ error: 'User is not a seller' });
      }

      const result = await payoutService.getPayoutDetails((request.params as any).payoutId, sellerId);
      
      if (!result.success) {
        return reply.code(404).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );

  // Get available balance (Sellers)
  fastify.get(
    '/payouts/balance',
    {
      preHandler: [authenticate, requireRole('SELLER')],
      schema: {
        tags: ['Payouts'],
        summary: 'Get available balance for payout',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sellerId = (request as any).user.sellerId;
      if (!sellerId) {
        return reply.code(403).send({ error: 'User is not a seller' });
      }

      const result = await payoutService.getAvailableBalance(sellerId);
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );

  // Admin routes
  
  // Get all payouts (Admin)
  fastify.get<{ Querystring: AdminPayoutQuery }>(
    '/admin/payouts',
    {
      preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')],
      schema: {
        querystring: AdminPayoutQuerySchema,
        tags: ['Admin', 'Payouts'],
        summary: 'Get all payouts (Admin)',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await payoutService.getAllPayouts((request.query as any));
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );

  // Process payout (Admin)
  fastify.patch<{ Params: { payoutId: string }, Body: ProcessPayoutBody }>(
    '/admin/payouts/:payoutId/process',
    {
      preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')],
      schema: {
        params: z.object({ payoutId: z.string() }),
        body: ProcessPayoutSchema,
        tags: ['Admin', 'Payouts'],
        summary: 'Process a pending payout',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await payoutService.processPayout(
        (request.params as any).payoutId,
        (request as any).user.userId,
        (request.body as any)
      );
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );

  // Reject payout (Admin)
  fastify.patch<{ Params: { payoutId: string }, Body: { reason: string } }>(
    '/admin/payouts/:payoutId/reject',
    {
      preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')],
      schema: {
        params: z.object({ payoutId: z.string() }),
        body: z.object({ reason: z.string() }),
        tags: ['Admin', 'Payouts'],
        summary: 'Reject a payout request',
        security: [{ bearerAuth: [] }]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await payoutService.rejectPayout(
        (request.params as any).payoutId,
        (request as any).user.userId,
        (request.body as any).reason
      );
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );

  // Get payout statistics (Admin)
  fastify.get(
    '/admin/payouts/statistics',
    {
      preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')],
      schema: {
        tags: ['Admin', 'Payouts'],
        summary: 'Get payout statistics',
        security: [{ bearerAuth: [] }]
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await payoutService.getPayoutStatistics();
      
      if (!result.success) {
        return reply.code(400).send({ error: result.error?.message });
      }

      return reply.send(result.data);
    }
  );
};

export default payoutRoutes;

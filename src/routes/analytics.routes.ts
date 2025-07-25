import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { logger } from '../utils/logger';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  const analyticsService = new AnalyticsService(fastify);

  /**
   * Get all analyticss
   */
  fastify.get<{ Querystring: { page?: number; limit?: number; search?: string } }>('/', {
    schema: {
      description: 'Get analytics data with pagination (requires admin role)',
      summary: 'Get analytics data',
      tags: ['PlatformAnalytics'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { page?: number; limit?: number; search?: string };
      const result = await analyticsService.findMany(query);
      return reply.send(result);
    } catch (error: any) {
      logger.error({ error, traceId: request.traceId }, 'AnalyticsService fetch failed');
      
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analytics data',
          statusCode: 500
        }
      });
    }
  });

  /**
   * Get analytics by ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Get analytics details by ID (requires admin role)',
      summary: 'Get analytics by ID',
      tags: ['PlatformAnalytics'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await analyticsService.findById(id);
      
      if (!result) {
        return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'AnalyticsService not found', statusCode: 404 }
        });
      }
      
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      logger.error({ error, traceId: request.traceId }, 'AnalyticsService fetch failed');
      
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch analytics event', statusCode: 500 }
      });
    }
  });

  /**
   * Create analytics (authenticated)
   */
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 }
        }
      }
    },
    preHandler: [authenticate, authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply) => {
    try {
      const result = await analyticsService.create({
        ...(request.body as any),
        userId: request.user!.userId
      });

      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      logger.error({ error, traceId: request.traceId }, 'AnalyticsService creation failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create analytics event', statusCode: 500 }
      });
    }
  });

  /**
   * Update analytics (authenticated)
   */
  fastify.put<{ Params: { id: string } }>('/:id', {
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
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 }
        }
      }
    },
    preHandler: [authenticate, authorize(['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await analyticsService.update(id, request.body as any);

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      logger.error({ error, traceId: request.traceId }, 'AnalyticsService update failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update analytics event', statusCode: 500 }
      });
    }
  });

  /**
   * Delete analytics (authenticated)
   */
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      await analyticsService.delete(id);

      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, traceId: request.traceId }, 'AnalyticsService deletion failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete analytics event', statusCode: 500 }
      });
    }
  });
}

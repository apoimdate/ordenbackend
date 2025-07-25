import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SellerService } from '../services/seller.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { logger } from '../utils/logger';

export default async function sellerRoutes(fastify: FastifyInstance) {
  const sellerService = new SellerService(fastify);

  /**
   * Get all sellers
   */
  fastify.get('/', {
    schema: {
      description: 'Get all sellers with pagination and search (public endpoint)',
      summary: 'Get all sellers',
      tags: ['Sellers'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number; search?: string } }>, reply: FastifyReply) => {
    const result = await sellerService.findMany(request.query);
    return reply.send(result);
  });

  /**
   * Get seller by ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Get seller details by ID (public endpoint)',
      summary: 'Get seller by ID',
      tags: ['Sellers'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const item = await sellerService.findById((request.params as any).id);
      
      if (!item) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'SellerService not found', statusCode: 404 }
        });
      }
      
      return reply.send({
        success: true,
        data: item
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'SellerService fetch failed');
      
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'SellerService not found', statusCode: 404 }
      });
    }
  });

  /**
   * Create seller (authenticated)
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const item = // @ts-ignore
 await sellerService.create({
        ...(request.body as any),
        userId: (request as any).user.userId
      });
      
      return reply.status(201).send({
        success: true,
        data: item
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'SellerService creation failed');
      throw error;
    }
  });

  /**
   * Update seller (authenticated)
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const item = await sellerService.update((request.params as any).id, (request.body as any));
      
      return reply.send({
        success: true,
        data: item
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'SellerService update failed');
      throw error;
    }
  });

  /**
   * Delete seller (authenticated)
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await sellerService.delete((request.params as any).id);
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'SellerService deletion failed');
      throw error;
    }
  });
}

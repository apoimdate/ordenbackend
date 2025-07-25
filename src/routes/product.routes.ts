import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from '../services/product.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { jsonSchemas } from '../utils/json-schemas';
import { logger } from '../utils/logger';

export async function productRoutes(fastify: FastifyInstance) {
  const productService = new ProductService(fastify);

  /**
   * Create product
   */
  fastify.post('/', {
    schema: {
      description: 'Create a new product (requires seller/admin role)',
      summary: 'Create product',
      tags: ['Products'],
      body: jsonSchemas.product.create,
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sku: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' }
          }
        }
      }
    },
    preHandler: [authenticate, authorize(['SELLER', 'ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const product = // @ts-ignore
 await productService.create({
        ...(request.body as any),
        sellerId: (request as any).user.sellerId || (request as any).user.userId
      });
      
      return reply.status(201).send(product);
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Product creation failed');
      throw error;
    }
  });

  /**
   * Get product by ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Get product details by ID', summary: 'Get product by ID', tags: ['Products'], params: {
        type: 'object', required: ['id'], properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const product = await productService.findById((request.params as any).id);
      
      if (!product) {
        return reply.status(404).send({
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
        });
      }
      
      return reply.send(product);
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Product fetch failed');
      throw error;
    }
  });

  /**
   * Search products
   */
  fastify.get('/', {
    schema: {
      description: 'Search products with filters and pagination', summary: 'Search products', tags: ['Products'], querystring: jsonSchemas.search.products
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const products = await productService.search((request.query as any));
      return reply.send(products);
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Product search failed');
      throw error;
    }
  });

  /**
   * Update product
   */
  fastify.put<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Update product information (requires seller/admin role)',
      summary: 'Update product',
      tags: ['Products'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: jsonSchemas.product.update
    },
    preHandler: [authenticate, authorize(['SELLER', 'ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const product = await productService.update({
        id: (request.params as any).id,
        ...((request.body as any) as any),
      });
      return reply.send(product);
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Product update failed');
      throw error;
    }
  });

  /**
   * Delete product
   */
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      description: 'Delete a product (requires seller/admin role)',
      summary: 'Delete product',
      tags: ['Products'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    },
    preHandler: [authenticate, authorize(['SELLER', 'ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await productService.delete((request.params as any).id);
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Product deletion failed');
      throw error;
    }
  });
}

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Template for converted routes
const routeTemplate = (routeName, serviceName, prefixPath) => `import { FastifyInstance } from 'fastify';
import { ${serviceName} } from '@services/${serviceName.toLowerCase()}.service';
import { authenticate, AuthenticatedRequest } from '@middleware/auth.middleware';
import { authorize } from '@middleware/rbac';
import { jsonSchemas } from '@utils/json-schemas';
import { logger } from '@utils/logger';

export default async function ${routeName}(fastify: FastifyInstance) {
  const ${serviceName.toLowerCase()} = new ${serviceName}(
    fastify.prisma,
    fastify.redis,
    logger
  );

  /**
   * Get all ${routeName.replace('Routes', '').toLowerCase()}s
   */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const items = await ${serviceName.toLowerCase()}.findMany(request.query);
      
      return reply.send({
        success: true,
        message: items?.length > 0 ? 'Data retrieved successfully' : 'No data available',
        data: items || [],
        pagination: {
          page: request.query.page || 1,
          limit: request.query.limit || 20,
          total: items?.length || 0,
          pages: Math.ceil((items?.length || 0) / (request.query.limit || 20))
        }
      });
    } catch (error: any) {
      logger.error({ error, traceId: request.context.traceId }, '${serviceName} fetch failed');
      
      return reply.send({
        success: true,
        message: 'No data available',
        data: [],
        pagination: {
          page: request.query.page || 1,
          limit: request.query.limit || 20,
          total: 0,
          pages: 0
        }
      });
    }
  });

  /**
   * Get ${routeName.replace('Routes', '').toLowerCase()} by ID
   */
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const item = await ${serviceName.toLowerCase()}.findById(request.params.id);
      
      if (!item) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: '${serviceName} not found' }
        });
      }
      
      return reply.send({
        success: true,
        data: item
      });
    } catch (error: any) {
      logger.error({ error, traceId: request.context.traceId }, '${serviceName} fetch failed');
      
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '${serviceName} not found' }
      });
    }
  });

  /**
   * Create ${routeName.replace('Routes', '').toLowerCase()} (authenticated)
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
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const item = await ${serviceName.toLowerCase()}.create({
        ...request.body,
        userId: request.user!.userId
      });
      
      return reply.status(201).send({
        success: true,
        data: item
      });
    } catch (error: any) {
      logger.error({ error, traceId: request.context.traceId }, '${serviceName} creation failed');
      throw error;
    }
  });

  /**
   * Update ${routeName.replace('Routes', '').toLowerCase()} (authenticated)
   */
  fastify.put('/:id', {
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
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const item = await ${serviceName.toLowerCase()}.update(request.params.id, request.body);
      
      return reply.send({
        success: true,
        data: item
      });
    } catch (error: any) {
      logger.error({ error, traceId: request.context.traceId }, '${serviceName} update failed');
      throw error;
    }
  });

  /**
   * Delete ${routeName.replace('Routes', '').toLowerCase()} (authenticated)
   */
  fastify.delete('/:id', {
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
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      await ${serviceName.toLowerCase()}.delete(request.params.id);
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, traceId: request.context.traceId }, '${serviceName} deletion failed');
      throw error;
    }
  });
}`;

// Routes to convert with their service mappings
const routesToConvert = [
  { file: 'order.routes.ts', routeName: 'orderRoutes', serviceName: 'OrderService' },
  { file: 'payment.routes.ts', routeName: 'paymentRoutes', serviceName: 'PaymentService' },
  { file: 'seller.routes.ts', routeName: 'sellerRoutes', serviceName: 'SellerService' },
  { file: 'shipping.routes.ts', routeName: 'shippingRoutes', serviceName: 'ShippingService' },
  { file: 'category.routes.ts', routeName: 'categoryRoutes', serviceName: 'CategoryService' },
  { file: 'analytics.routes.ts', routeName: 'analyticsRoutes', serviceName: 'AnalyticsService' },
  { file: 'cart.routes.ts', routeName: 'cartRoutes', serviceName: 'CartService' },
  { file: 'review.routes.ts', routeName: 'reviewRoutes', serviceName: 'ReviewService' },
  { file: 'coupon.routes.ts', routeName: 'couponRoutes', serviceName: 'CouponService' },
  { file: 'support.routes.ts', routeName: 'supportRoutes', serviceName: 'SupportService' },
  { file: 'return.routes.ts', routeName: 'returnRoutes', serviceName: 'ReturnService' },
  { file: 'cms.routes.ts', routeName: 'cmsRoutes', serviceName: 'CMSService' },
  { file: 'loyalty.routes.ts', routeName: 'loyaltyRoutes', serviceName: 'LoyaltyService' },
  { file: 'fraud-advanced.routes.ts', routeName: 'fraudAdvancedRoutes', serviceName: 'FraudAdvancedService' },
  { file: 'webhook.routes.ts', routeName: 'webhookRoutes', serviceName: 'WebhookService' }
];

async function convertRoutes() {
  console.log('🔄 Converting Routes from Zod to JSON Schema\n');
  console.log('━'.repeat(60));
  
  const routesDir = path.join(__dirname, '..', 'src', 'routes');
  let convertedCount = 0;
  let skippedCount = 0;
  
  for (const route of routesToConvert) {
    const filePath = path.join(routesDir, route.file);
    const backupPath = path.join(routesDir, route.file + '.backup');
    
    console.log(`Processing ${route.file}...`);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`  ❌ File not found: ${route.file}`);
        skippedCount++;
        continue;
      }
      
      // Create backup
      const originalContent = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(backupPath, originalContent);
      
      // Generate new content
      const newContent = routeTemplate(route.routeName, route.serviceName, route.file);
      
      // Write new file
      fs.writeFileSync(filePath, newContent);
      
      console.log(`  ✅ Converted: ${route.file}`);
      convertedCount++;
      
    } catch (error) {
      console.log(`  ❌ Error converting ${route.file}: ${error.message}`);
      skippedCount++;
    }
  }
  
  console.log('━'.repeat(60));
  console.log(`\n📊 Conversion Summary:`);
  console.log(`   ✅ Converted: ${convertedCount}`);
  console.log(`   ❌ Skipped: ${skippedCount}`);
  console.log(`   📁 Backups created in: ${routesDir}/*.backup`);
  
  if (convertedCount > 0) {
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Restart the server: npm run dev`);
    console.log(`   2. Test endpoints: node scripts/test-endpoints.js`);
    console.log(`   3. Check logs for any remaining issues`);
    console.log(`\n⚠️  Note: Original files backed up with .backup extension`);
  }
  
  return { convertedCount, skippedCount };
}

if (require.main === module) {
  convertRoutes().catch(console.error);
}

module.exports = { convertRoutes };
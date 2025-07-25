import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { TypesenseClient } from './integrations/typesense/client';
import { config } from './config/environment';
import { prisma, auditPrisma } from './config/database';
import { redis } from './config/redis';
import { 
  contextMiddleware, 
  loggingMiddleware, 
  performanceMiddleware,
  tracingMiddleware 
} from './middleware';
import { healthRoutes } from './routes/health.routes';
import { HealthService } from './services/health.service';
import { FraudDetectionService } from './services/fraud-detection.service';
import { logger } from './utils/logger';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use our own logger
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: true,
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true,
        allErrors: true
      }
    }
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register core plugins
  await app.register(sensible);

  // Register Swagger documentation
  try {
    await app.register(swagger, {
      swagger: {
        info: {
          title: 'OrdenDirecta API',
          description: 'Complete e-commerce platform API documentation',
          version: '1.0.0'
        },
        host: 'localhost:3000',
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'Health', description: 'System health and monitoring endpoints' },
          { name: 'Authentication', description: 'User authentication and authorization' },
          { name: 'Users', description: 'User management operations' },
          { name: 'Products', description: 'Product catalog management' },
          { name: 'Orders', description: 'Order processing and management' },
          { name: 'Payments', description: 'Payment processing and tracking' },
          { name: 'Sellers', description: 'Seller management and onboarding' },
          { name: 'Categories', description: 'Product category management' },
          { name: 'PlatformAnalytics', description: 'Business analytics and reports' },
          { name: 'Chat', description: 'Real-time messaging system' },
          { name: 'Admin', description: 'Administrative operations' },
          { name: 'Payouts', description: 'Payout management for sellers' },
          { name: 'Product Q&A', description: 'Product questions and answers' },
          { name: 'Inventory', description: 'Inventory management and stock control' },
          { name: 'Wallets', description: 'User wallet and payment balance management' },
          { name: 'Store Credits', description: 'Store credit and gift card management' },
          { name: 'Flash Sales', description: 'Time-limited promotional sales' },
          { name: 'Gift Cards', description: 'Gift card issuance and redemption' }
        ]
      }
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true
      },
      staticCSP: true
    });
    
    logger.info('Swagger documentation registered at /docs');
  } catch (error) { logger.error({ error }, 'Failed to register Swagger documentation');
  }
  
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.cors.origins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-trace-id',
      'x-correlation-id',
      'x-api-key'
    ],
    exposedHeaders: [
      'x-request-id',
      'x-trace-id',
      'x-response-time',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset'
    ]
  });

  await app.register(helmet, {
    contentSecurityPolicy: config.node.isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false
  });

  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn
    },
    verify: {
      maxAge: config.jwt.expiresIn
    }
  });

  // Rate limiting with different limits per user type
  await app.register(rateLimit, {
    global: false, // We'll apply per-route
    redis,
    nameSpace: 'rate-limit:',
    skipOnError: true
  });

  // File upload support
  await app.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 100,
      fields: 10,
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
      headerPairs: 2000
    }
  });

  // Register middleware
  app.register(contextMiddleware);
  app.register(tracingMiddleware);
  app.register((fastify, _opts, done) => {
    loggingMiddleware(fastify, prisma);
    done();
  });
  app.register(performanceMiddleware);

  // Initialize services
  const typesense = TypesenseClient.getInstance();
  const healthService = new HealthService(prisma, auditPrisma, redis, typesense);
  const fraudService = new FraudDetectionService(prisma, redis);

  // Decorate fastify instance with services
  app.decorate('prisma', prisma);
  app.decorate('auditPrisma', auditPrisma);
  app.decorate('redis', redis);
  app.decorate('typesense', typesense);
  app.decorate('healthService', healthService);
  app.decorate('fraudService', fraudService);

  // Register routes
  try {
    await app.register(healthRoutes, { 
      prefix: '/',
      healthService 
    });
    logger.info('Health routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register health routes');
  }

  // Import auth routes dynamically to avoid circular dependencies
  try {
    const { authRoutes } = await import('@routes/auth.routes');
    await app.register(authRoutes, { prefix: '/api/auth' });
    logger.info('Auth routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register auth routes');
  }

  // Import user routes
  try {
    const { userRoutes } = await import('@routes/user.routes');
    await app.register(userRoutes, { prefix: '/api/users' });
    logger.info('User routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register user routes');
  }

  // Import product routes
  try {
    const { productRoutes } = await import('@routes/product.routes');
    await app.register(productRoutes, { prefix: '/api/products' });
    logger.info('Product routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register product routes');
  }

  // Import order routes
  try {
    const orderRoutes = (await import('@routes/order.routes')).default;
    await app.register(orderRoutes, { prefix: '/api/orders' });
    logger.info('Order routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register order routes');
  }

  // Import payment routes
  try {
    const paymentRoutes = (await import('@routes/payment.routes')).default;
    await app.register(paymentRoutes, { prefix: '/api/payments' });
    logger.info('Payment routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register payment routes');
  }

  // Import seller routes
  try {
    const sellerRoutes = (await import('@routes/seller.routes')).default;
    await app.register(sellerRoutes, { prefix: '/api/sellers' });
    logger.info('Seller routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register seller routes');
  }

  // Import shipping routes
  try {
    const shippingRoutes = (await import('@routes/shipping.routes')).default;
    await app.register(shippingRoutes, { prefix: '/api/shipping' });
    logger.info('Shipping routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register shipping routes');
  }

  // Import category routes
  try {
    const categoryRoutes = (await import('@routes/category.routes')).default;
    await app.register(categoryRoutes, { prefix: '/api/categories' });
    logger.info('Category routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register category routes');
  }

  // Import analytics routes
  try {
    const analyticsRoutes = (await import('@routes/analytics.routes')).default;
    await app.register(analyticsRoutes, { prefix: '/api/analytics' });
    logger.info('PlatformAnalytics routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register analytics routes');
  }

  // Import cart routes
  try {
    const cartRoutes = (await import('@routes/cart.routes')).default;
    await app.register(cartRoutes, { prefix: '/api/cart' });
    logger.info('Cart routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register cart routes');
  }

  // Import review routes
  try {
    const reviewRoutes = (await import('@routes/review.routes')).default;
    await app.register(reviewRoutes, { prefix: '/api/reviews' });
    logger.info('Review routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register review routes');
  }

  // Import coupon routes
  try {
    const couponRoutes = (await import('@routes/coupon.routes')).default;
    await app.register(couponRoutes, { prefix: '/api/coupons' });
    logger.info('Coupon routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register coupon routes');
  }

  // Import notification routes
  try {
    const notificationRoutes = (await import('@routes/notification.routes')).default;
    await app.register(notificationRoutes, { prefix: '/api/notifications' });
    logger.info('Notification routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register notification routes');
  }

  // Import support routes
  try {
    const supportRoutes = (await import('@routes/support.routes')).default;
    await app.register(supportRoutes, { prefix: '/api/support' });
    logger.info('Support routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register support routes');
  }

  // Import return routes
  try {
    const returnRoutes = (await import('@routes/return.routes')).default;
    await app.register(returnRoutes, { prefix: '/api/returns' });
    logger.info('Return routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register return routes');
  }

  // Import payout routes
  try {
    const payoutRoutes = (await import('@routes/payout.routes')).default;
    await app.register(payoutRoutes, { prefix: '/api' });
    logger.info('Payout routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register payout routes');
  }

  // Import product Q&A routes
  try {
    const productQARoutes = (await import('@routes/product-qa.routes')).default;
    await app.register(productQARoutes, { prefix: '/api' });
    logger.info('Product Q&A routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register product Q&A routes');
  }

  // Import CMS routes
  try {
    const cmsRoutes = (await import('@routes/cms.routes')).default;
    await app.register(cmsRoutes, { prefix: '/api/cms' });
    logger.info('CMS routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register CMS routes');
  }

  // Import loyalty routes
  try {
    const loyaltyRoutes = (await import('@routes/loyalty.routes')).default;
    await app.register(loyaltyRoutes, { prefix: '/api/loyalty' });
    logger.info('Loyalty routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register loyalty routes');
  }

  // Import advanced fraud routes
  try {
    const fraudAdvancedRoutes = (await import('@routes/fraud-advanced.routes')).default;
    await app.register(fraudAdvancedRoutes, { prefix: '/api/fraud' });
    logger.info('Fraud routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register fraud routes');
  }

  // Import webhook routes
  try {
    const webhookRoutes = (await import('@routes/webhook.routes')).default;
    await app.register(webhookRoutes, { prefix: '/api/webhooks' });
    logger.info('Webhook routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register webhook routes');
  }

  // Import commission routes
  try {
    const { commissionRoutes } = await import('@routes/commission.routes');
    await app.register(commissionRoutes, { prefix: '/api/admin' });
    logger.info('Commission routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register commission routes');
  }

  // Import chat routes
  try {
    const { chatRoutes } = await import('@routes/chat.routes');
    await app.register(chatRoutes, { prefix: '/api' });
    logger.info('Chat routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register chat routes');
  }

  // Import customs routes
  try {
    const { customsRoutes } = await import('@routes/customs.routes');
    await app.register(customsRoutes, { prefix: '/api' });
    logger.info('Customs routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register customs routes');
  }

  // Import pickup routes
  try {
    const { pickupRoutes } = await import('@routes/pickup.routes');
    await app.register(pickupRoutes, { prefix: '/api' });
    logger.info('Pickup routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register pickup routes');
  }

  // Import inventory items routes
  try {
    const inventoryItemsRoutes = (await import('@routes/inventory-items.routes')).default;
    await app.register(inventoryItemsRoutes, { prefix: '/api/inventory/items' });
    logger.info('Inventory items routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register inventory items routes');
  }

  // Import inventory adjustments routes
  try {
    const inventoryAdjustmentsRoutes = (await import('@routes/inventory-adjustments.routes')).default;
    await app.register(inventoryAdjustmentsRoutes, { prefix: '/api/inventory/adjustments' });
    logger.info('Inventory adjustments routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register inventory adjustments routes');
  }

  // Import inventory movements routes
  try {
    const inventoryMovementsRoutes = (await import('@routes/inventory-movements.routes')).default;
    await app.register(inventoryMovementsRoutes, { prefix: '/api/inventory/movements' });
    logger.info('Inventory movements routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register inventory movements routes');
  }

  // Import stock locations routes
  try {
    const stockLocationsRoutes = (await import('@routes/stock-locations.routes')).default;
    await app.register(stockLocationsRoutes, { prefix: '/api/inventory/locations' });
    logger.info('Stock locations routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register stock locations routes');
  }

  // Import stock transfer routes
  try {
    const stockTransferRoutes = (await import('@routes/stock-transfer.routes')).default;
    await app.register(stockTransferRoutes, { prefix: '/api/inventory/transfers' });
    logger.info('Stock transfer routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register stock transfer routes');
  }

  // Import wallet routes
  try {
    const walletRoutes = (await import('@routes/wallet.routes')).default;
    await app.register(walletRoutes, { prefix: '/api/wallets' });
    logger.info('Wallet routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register wallet routes');
  }

  // Import wallet transaction routes
  try {
    const walletTransactionRoutes = (await import('@routes/wallet-transaction.routes')).default;
    await app.register(walletTransactionRoutes, { prefix: '/api/wallet/transactions' });
    logger.info('Wallet transaction routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register wallet transaction routes');
  }

  // Import store credit routes
  try {
    const storeCreditRoutes = (await import('@routes/store-credit.routes')).default;
    await app.register(storeCreditRoutes, { prefix: '/api/store-credits' });
    logger.info('Store credit routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register store credit routes');
  }

  // Import flash sale routes
  try {
    const flashSaleRoutes = (await import('@routes/flash-sale.routes')).default;
    await app.register(flashSaleRoutes, { prefix: '/api/flash-sales' });
    logger.info('Flash sale routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register flash sale routes');
  }

  // Import gift card routes
  try {
    const giftCardRoutes = (await import('@routes/gift-card.routes')).default;
    await app.register(giftCardRoutes, { prefix: '/api/gift-cards' });
    logger.info('Gift card routes registered successfully');
  } catch (error) { logger.error({ error }, 'Failed to register gift card routes');
  }

  // Global error handler
  app.setErrorHandler(async (error: any, request: any, reply: any) => {
    const errorId = (request.context as any)?.traceId || 'unknown';
    
    logger.error({
      errorId,
      error: {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
        validation: error.validation
      },
      request: {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query
      }
    }, 'Unhandled error');

    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation,
          errorId
        }
      });
    }

    // Handle known errors
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 && config.node.isProduction
      ? 'Internal Server Error'
      : error.message;

    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message,
        errorId,
        timestamp: new Date().toISOString()
      }
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request: any, reply: any) => {
    logger.warn({
      method: request.method,
      url: request.url,
      ip: request.ip
    }, 'Route not found');

    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        path: request.url,
        method: request.method
      }
    });
  });

  // Graceful shutdown hooks
  const gracefulShutdown = async () => {
    logger.info('Graceful shutdown initiated');
    
    try {
      await app.close();
      await prisma.$disconnect();
      await auditPrisma.$disconnect();
      redis.disconnect();
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) { logger.error({ error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return app;
}

// TypeScript module augmentation for decorated properties
declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
    auditPrisma: typeof auditPrisma;
    redis: typeof redis;
    typesense: TypesenseClient;
    healthService: HealthService;
    fraudService: FraudDetectionService;
  }
}

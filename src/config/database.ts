import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Main business database
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: [
    {
      emit: 'event',
      level: 'query'
    },
    {
      emit: 'event',
      level: 'error'
    },
    {
      emit: 'event',
      level: 'info'
    },
    {
      emit: 'event',
      level: 'warn'
    }
  ],
  errorFormat: 'pretty'
});

// Audit database connection (using same DB but different schema)
export const auditPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  errorFormat: 'minimal'
});

// Event logging for main database
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
      target: e.target
    }, 'Database query');
  });
}

prisma.$on('error', (e: any) => {
  logger.error({
    message: e.message,
    target: e.target,
    timestamp: e.timestamp
  }, 'Database error');
});

// Middleware for soft deletes
prisma.$use(async (params, next) => {
  // Handle soft deletes for models with isDeleted field
  const softDeleteModels = [
    'User', 'Product', 'Category', 'Brand', 'Seller', 'Coupon',
    'Promotion', 'Review', 'Content', 'FAQ', 'Page', 'BlogPost'
  ];

  if (params.model && softDeleteModels.includes(params.model)) {
    if (params.action === 'delete') {
      // Change to update with soft delete
      params.action = 'update';
      params.args['data'] = { 
        isDeleted: true, 
        deletedAt: new Date() 
      };
    }

    if (params.action === 'deleteMany') {
      // Change to updateMany with soft delete
      params.action = 'updateMany';
      params.args['data'] = { 
        isDeleted: true, 
        deletedAt: new Date() 
      };
    }

    // Exclude soft deleted records from queries
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        isDeleted: false
      };
    }

    if (params.action === 'findMany') {
      if (params.args.where) {
        if (params.args.where.isDeleted === undefined) {
          params.args.where = {
            ...params.args.where,
            isDeleted: false
          };
        }
      } else {
        params.args.where = {
          isDeleted: false
        };
      }
    }
  }

  return next(params);
});

// Middleware for automatic timestamp updates
prisma.$use(async (params, next) => {
  const modelsWithTimestamps = [
    'User', 'Product', 'Order', 'Payment', 'Seller', 'Category',
    'Review', 'Cart', 'Wishlist', 'Notification'
  ];

  if (params.model && modelsWithTimestamps.includes(params.model)) {
    if (params.action === 'update' || params.action === 'updateMany') {
      params.args.data = {
        ...params.args.data,
        updatedAt: new Date()
      };
    }
  }

  return next(params);
});

// Connection management
export async function connectDatabase() {
  try {
    await prisma.$connect();
    await auditPrisma.$connect();
    logger.info('Database connections established');
  } catch (_error) { logger.error({ error: _error }, 'Failed to connect to database');
    throw _error;
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    await auditPrisma.$disconnect();
    logger.info('Database connections closed');
  } catch (_error) { logger.error({ error: _error }, 'Failed to disconnect from database');
    throw _error;
  }
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await auditPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch (_error) { logger.error({ error: _error }, 'Database health check failed');
    return false;
  }
}

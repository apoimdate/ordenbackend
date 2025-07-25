import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Test database setup
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/ordendirecta_test'
    }
  }
});

export const testAuditPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_AUDIT_DATABASE_URL || 'postgresql://test:test@localhost:5432/ordendirecta_audit_test'
    }
  }
});

// Test Redis setup
export const testRedis = new Redis({
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
  db: parseInt(process.env.TEST_REDIS_DB || '1'), // Use different DB for tests
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

// Global test setup
let app: FastifyInstance;

export const setupTestApp = async (): Promise<FastifyInstance> => {
  if (!app) {
    app = await buildApp();
    
    // Override database connections for testing
    app.decorate('prisma', testPrisma);
    app.decorate('auditPrisma', testAuditPrisma);
    app.decorate('redis', testRedis);
  }
  
  return app;
};

export const cleanupTestApp = async (): Promise<void> => {
  if (app) {
    await app.close();
  }
  
  await testPrisma.$disconnect();
  await testAuditPrisma.$disconnect();
  testRedis.disconnect();
};

// Database cleanup helpers
export const cleanupDatabase = async (): Promise<void> => {
  // Delete all data in reverse dependency order
  const tables = [
    'webhookDelivery',
    'webhook',
    'fraudRuleExecution',
    'fraudRule',
    'fraudAlert',
    'fraudRiskAssessment',
    'loyaltyPointsTransaction',
    'giftCardTransaction',
    'giftCard',
    'loyaltyPoints',
    'page',
    'blogPost',
    'returnRequest',
    'supportTicket',
    'faq',
    'notification',
    'couponUsage',
    'flashSale',
    'coupon',
    'review',
    'cartItem',
    'wishlistItem',
    'orderItem',
    'order',
    'payment',
    'analyticsEvent',
    'product',
    'category',
    'shippingRate',
    'seller',
    'userSession',
    'user'
  ];

  for (const table of tables) {
    try {
      await testPrisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch (error) {
      // Table might not exist or might be empty
      console.warn(`Could not clean table ${table}:`, error);
    }
  }

  // Clean audit database
  try {
    await testAuditPrisma.$executeRawUnsafe('DELETE FROM "AuditLog"');
  } catch (error) {
    console.warn('Could not clean audit table:', error);
  }

  // Clean Redis
  await testRedis.flushdb();
};

// Test data factories
export const createTestUser = async (overrides: any = {}) => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    emailVerified: true,
    ...overrides
  };

  return await testPrisma.user.create({
    data: defaultUser
  });
};

export const createTestSeller = async (overrides: any = {}) => {
  const user = await createTestUser({ role: 'SELLER' });
  
  const defaultSeller = {
    userId: user.id,
    businessName: 'Test Business',
    businessType: 'CORPORATION',
    description: 'Test business description',
    status: 'ACTIVE',
    isVerified: true,
    ...overrides
  };

  return await testPrisma.seller.create({
    data: defaultSeller,
    include: {
      user: true
    }
  });
};

export const createTestCategory = async (overrides: any = {}) => {
  const defaultCategory = {
    name: `Test Category ${Date.now()}`,
    slug: `test-category-${Date.now()}`,
    description: 'Test category description',
    isActive: true,
    ...overrides
  };

  return await testPrisma.category.create({
    data: defaultCategory
  });
};

export const createTestProduct = async (overrides: any = {}) => {
  let seller = overrides.seller;
  if (!seller) {
    seller = await createTestSeller();
  }

  let category = overrides.category;
  if (!category) {
    category = await createTestCategory();
  }

  const defaultProduct = {
    name: `Test Product ${Date.now()}`,
    description: 'Test product description',
    price: 99.99,
    currency: 'USD',
    sku: `TEST-SKU-${Date.now()}`,
    stock: 100,
    status: 'ACTIVE',
    sellerId: seller.id,
    categoryId: category.id,
    ...overrides
  };

  delete defaultProduct.seller;
  delete defaultProduct.category;

  return await testPrisma.product.create({
    data: defaultProduct,
    include: {
      seller: {
        include: {
          user: true
        }
      },
      category: true
    }
  });
};

export const createTestOrder = async (overrides: any = {}) => {
  let user = overrides.user;
  if (!user) {
    user = await createTestUser();
  }

  let product = overrides.product;
  if (!product) {
    product = await createTestProduct();
  }

  const defaultOrder = {
    userId: user.id,
    orderNumber: `ORD-${Date.now()}`,
    status: 'PENDING',
    total: 99.99,
    currency: 'USD',
    shippingAddress: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'US'
    },
    ...overrides
  };

  delete defaultOrder.user;
  delete defaultOrder.product;

  const order = await testPrisma.order.create({
    data: defaultOrder
  });

  // Add order item
  await testPrisma.orderItem.create({
    data: {
      orderId: order.id,
      productId: product.id,
      quantity: overrides.quantity || 1,
      price: product.price,
      currency: product.currency
    }
  });

  return await testPrisma.order.findUnique({
    where: { id: order.id },
    include: {
      user: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });
};

export const createAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`
});

export const generateTestJWT = async (user: any): Promise<string> => {
  const app = await setupTestApp();
  return app.jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role
  });
};

// Test utilities
export const waitFor = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const expectValidationError = (response: any, field?: string) => {
  expect(response.statusCode).toBe(400);
  expect(response.json().error).toContain('validation');
  if (field) {
    expect(response.json().details).toBeDefined();
  }
};

export const expectUnauthorized = (response: any) => {
  expect(response.statusCode).toBe(401);
  expect(response.json().error).toContain('Unauthorized');
};

export const expectForbidden = (response: any) => {
  expect(response.statusCode).toBe(403);
  expect(response.json().error).toContain('Forbidden');
};

export const expectNotFound = (response: any) => {
  expect(response.statusCode).toBe(404);
  expect(response.json().error).toContain('not found');
};

// Mock data generators
export const generateMockUser = (overrides: any = {}) => ({
  email: `user-${Date.now()}@example.com`,
  password: 'Password123!',
  firstName: 'John',
  lastName: 'Doe',
  role: 'CUSTOMER',
  ...overrides
});

export const generateMockProduct = (overrides: any = {}) => ({
  name: `Product ${Date.now()}`,
  description: 'Test product description',
  price: Math.floor(Math.random() * 1000) + 10,
  currency: 'USD',
  sku: `SKU-${Date.now()}`,
  stock: Math.floor(Math.random() * 100) + 1,
  ...overrides
});

export const generateMockOrder = (overrides: any = {}) => ({
  total: Math.floor(Math.random() * 1000) + 10,
  currency: 'USD',
  shippingAddress: {
    street: '123 Main St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'US'
  },
  ...overrides
});

// Performance testing helpers
export const measureExecutionTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const time = Number(end - start) / 1_000_000; // Convert to milliseconds
  
  return { result, time };
};

export const expectPerformance = (time: number, maxTime: number) => {
  expect(time).toBeLessThan(maxTime);
};

// Load testing helpers
export const createConcurrentRequests = async <T>(
  requestFn: () => Promise<T>,
  count: number
): Promise<T[]> => {
  const requests = Array(count).fill(null).map(() => requestFn());
  return Promise.all(requests);
};

export const measureThroughput = async <T>(
  requestFn: () => Promise<T>,
  duration: number // in milliseconds
): Promise<{ count: number; rps: number }> => {
  const start = Date.now();
  let count = 0;
  
  while (Date.now() - start < duration) {
    await requestFn();
    count++;
  }
  
  const actualDuration = Date.now() - start;
  const rps = (count / actualDuration) * 1000; // requests per second
  
  return { count, rps };
};

// Environment setup check
export const checkTestEnvironment = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must be run with NODE_ENV=test');
  }
  
  if (!process.env.TEST_DATABASE_URL) {
    console.warn('TEST_DATABASE_URL not set, using default test database');
  }
  
  if (!process.env.TEST_REDIS_HOST) {
    console.warn('TEST_REDIS_HOST not set, using localhost');
  }
};

// Setup and teardown for Jest
beforeAll(async () => {
  checkTestEnvironment();
  await setupTestApp();
});

afterAll(async () => {
  await cleanupTestApp();
});

beforeEach(async () => {
  await cleanupDatabase();
});

// Export test database instances for direct access
export { testPrisma as prisma, testAuditPrisma as auditPrisma, testRedis as redis };
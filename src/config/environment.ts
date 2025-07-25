import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Environment schema
const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  
  // Server
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DATABASE_URL: z.string().url(),
  AUDIT_DATABASE_URL: z.string().url().optional(),
  
  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Typesense
  TYPESENSE_HOST: z.string().default('localhost'),
  TYPESENSE_PORT: z.string().transform(Number).default('8108'),
  TYPESENSE_PROTOCOL: z.string().default('http'),
  TYPESENSE_API_KEY: z.string(),
  
  // CORS
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),
  
  // 2FA
  TWO_FACTOR_APP_NAME: z.string().default('OrdenDirecta'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_ADMIN: z.string().transform(Number).default('1000'),
  RATE_LIMIT_MAX_SELLER: z.string().transform(Number).default('500'),
  RATE_LIMIT_MAX_USER: z.string().transform(Number).default('100'),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  
  // Payment Gateways
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(['sandbox', 'production']).default('sandbox'),
  
  // Email
  EMAIL_FROM: z.string().email().default('noreply@ordendirecta.com'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().transform(Number).default('587'),
  EMAIL_SECURE: z.string().transform(val => val === 'true').default('false'),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  
  // SMS
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  
  // Storage
  STORAGE_TYPE: z.enum(['local', 's3', 'r2']).default('local'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_BUCKET: z.string().optional(),
  
  // CDN
  CDN_URL: z.string().url().optional(),
  
  // Session
  SESSION_SECRET: z.string().min(32),
  
  // Commission
  DEFAULT_COMMISSION_RATE: z.string().transform(Number).default('0.15'),
  MIN_COMMISSION_RATE: z.string().transform(Number).default('0.05'),
  MAX_COMMISSION_RATE: z.string().transform(Number).default('0.30'),
  
  // Fraud Detection
  FRAUD_SCORE_THRESHOLD: z.string().transform(Number).default('0.7'),
  ENABLE_FRAUD_DETECTION: z.string().transform(val => val === 'true').default('true'),
  
  // Search
  SEARCH_MIN_LENGTH: z.string().transform(Number).default('2'),
  SEARCH_MAX_RESULTS: z.string().transform(Number).default('100'),
  
  // Cache TTL
  CACHE_TTL_SHORT: z.string().transform(Number).default('60'),
  CACHE_TTL_MEDIUM: z.string().transform(Number).default('300'),
  CACHE_TTL_LONG: z.string().transform(Number).default('3600'),
  CACHE_TTL_VERY_LONG: z.string().transform(Number).default('86400'),
  
  // API Keys
  INTERNAL_API_KEY: z.string().optional()
});

// Parse and validate environment
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  logger.error({ errors: parseResult.error.errors }, 'Environment validation failed');
  console.error('❌ Environment validation failed:');
  parseResult.error.errors.forEach(error => {
    console.error(`  - ${error.path}: ${error.message}`);
  });
  process.exit(1);
}

export const env = parseResult.data;

// Development environment warnings
if (env.NODE_ENV === 'development') {
  if (!env.STRIPE_SECRET_KEY) {
    logger.warn('Stripe is not configured - payments will not work');
  }
  if (!env.EMAIL_HOST) {
    logger.warn('Email is not configured - email notifications will not work');
  }
  if (!env.TWILIO_ACCOUNT_SID) {
    logger.warn('Twilio is not configured - SMS notifications will not work');
  }
}

// Production environment checks
if (env.NODE_ENV === 'production') {
  const requiredProdVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'CDN_URL'
  ];

  const missingProdVars = requiredProdVars.filter(varName => !process.env[varName]);
  
  if (missingProdVars.length > 0) {
    logger.error({ missingProdVars }, 'Missing required production environment variables');
    process.exit(1);
  }
}

// Export typed config object
export const config = {
  node: {
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isStaging: env.NODE_ENV === 'staging'
  },
  server: {
    port: env.PORT,
    host: env.HOST
  },
  database: {
    url: env.DATABASE_URL,
    auditUrl: env.AUDIT_DATABASE_URL || env.DATABASE_URL
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  },
  typesense: {
    host: env.TYPESENSE_HOST,
    port: env.TYPESENSE_PORT,
    protocol: env.TYPESENSE_PROTOCOL,
    apiKey: env.TYPESENSE_API_KEY
  },
  cors: {
    origins: env.ALLOWED_ORIGINS
  },
  rateLimit: {
    window: env.RATE_LIMIT_WINDOW,
    max: {
      admin: env.RATE_LIMIT_MAX_ADMIN,
      seller: env.RATE_LIMIT_MAX_SELLER,
      user: env.RATE_LIMIT_MAX_USER
    }
  },
  email: {
    from: env.EMAIL_FROM,
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: env.EMAIL_USER && env.EMAIL_PASS ? {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS
    } : undefined
  },
  sms: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER
  },
  storage: {
    type: env.STORAGE_TYPE,
    s3: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_REGION,
      bucket: env.AWS_BUCKET
    }
  },
  payment: {
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY
    },
    paypal: {
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      mode: env.PAYPAL_MODE
    }
  },
  fraud: {
    scoreThreshold: env.FRAUD_SCORE_THRESHOLD,
    enabled: env.ENABLE_FRAUD_DETECTION
  },
  cache: {
    ttl: {
      short: env.CACHE_TTL_SHORT,
      medium: env.CACHE_TTL_MEDIUM,
      long: env.CACHE_TTL_LONG,
      veryLong: env.CACHE_TTL_VERY_LONG
    }
  },
  commission: {
    default: env.DEFAULT_COMMISSION_RATE,
    min: env.MIN_COMMISSION_RATE,
    max: env.MAX_COMMISSION_RATE
  }
};
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenvConfig();

// Environment schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DATABASE_URL: z.string(),
  AUDIT_DATABASE_URL: z.string().optional(),
  
  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),
  
  // Auth
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string(),
  
  // Email
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().default('587'),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string(),
  
  // Typesense
  TYPESENSE_HOST: z.string().default('localhost'),
  TYPESENSE_PORT: z.string().default('8108'),
  TYPESENSE_PROTOCOL: z.string().default('http'),
  TYPESENSE_API_KEY: z.string(),
  
  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default('ordendirecta-assets'),
  AWS_CDN_URL: z.string().optional(),
  
  // API Keys
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  
  // App URLs
  FRONTEND_URL: z.string().default('http://localhost:3001'),
  API_URL: z.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.string().default('true'),
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW: z.string().default('15m'),
  
  // Fraud Detection
  FRAUD_DETECTION_ENABLED: z.string().default('true'),
  FRAUD_MAX_RISK_SCORE: z.string().default('0.8'),
  FRAUD_BLOCK_THRESHOLD: z.string().default('0.9'),
  FRAUD_REVIEW_THRESHOLD: z.string().default('0.6'),
  
  // Logging
  LOG_LEVEL: z.string().default('info'),
  LOG_PRETTY: z.string().default('true'),
  
  // Security
  CORS_ORIGIN: z.string().default('*'),
  ALLOWED_CURRENCIES: z.string().default('USD,EUR'),
  BLOCKED_CURRENCIES: z.string().default('CUP')
});

// Parse and validate environment variables
const envConfig = envSchema.parse(process.env);

export const config = {
  env: envConfig.NODE_ENV,
  isDevelopment: envConfig.NODE_ENV === 'development',
  isProduction: envConfig.NODE_ENV === 'production',
  isTest: envConfig.NODE_ENV === 'test',
  
  server: {
    port: parseInt(envConfig.PORT, 10),
    host: envConfig.HOST
  },
  
  database: {
    url: envConfig.DATABASE_URL,
    auditUrl: envConfig.AUDIT_DATABASE_URL || envConfig.DATABASE_URL
  },
  
  redis: {
    host: envConfig.REDIS_HOST,
    port: parseInt(envConfig.REDIS_PORT, 10),
    password: envConfig.REDIS_PASSWORD,
    db: parseInt(envConfig.REDIS_DB, 10)
  },
  
  auth: {
    jwt: {
      secret: envConfig.JWT_SECRET,
      refreshSecret: envConfig.JWT_REFRESH_SECRET,
      expiresIn: envConfig.JWT_EXPIRES_IN,
      refreshExpiresIn: envConfig.JWT_REFRESH_EXPIRES_IN
    },
    session: {
      secret: envConfig.SESSION_SECRET
    }
  },
  
  email: {
    smtp: {
      host: envConfig.SMTP_HOST,
      port: parseInt(envConfig.SMTP_PORT, 10),
      secure: envConfig.SMTP_SECURE === 'true',
      auth: {
        user: envConfig.SMTP_USER,
        pass: envConfig.SMTP_PASS
      }
    },
    from: envConfig.SMTP_FROM
  },
  
  typesense: {
    host: envConfig.TYPESENSE_HOST,
    port: parseInt(envConfig.TYPESENSE_PORT, 10),
    protocol: envConfig.TYPESENSE_PROTOCOL,
    apiKey: envConfig.TYPESENSE_API_KEY
  },
  
  aws: {
    region: envConfig.AWS_REGION,
    accessKeyId: envConfig.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY || '',
    s3: {
      bucket: envConfig.AWS_S3_BUCKET,
      cdnUrl: envConfig.AWS_CDN_URL || ''
    }
  },
  
  payment: {
    stripe: {
      secretKey: envConfig.STRIPE_SECRET_KEY || '',
      webhookSecret: envConfig.STRIPE_WEBHOOK_SECRET || ''
    },
    paypal: {
      clientId: envConfig.PAYPAL_CLIENT_ID || '',
      clientSecret: envConfig.PAYPAL_CLIENT_SECRET || ''
    }
  },
  
  app: {
    frontendUrl: envConfig.FRONTEND_URL,
    apiUrl: envConfig.API_URL
  },
  
  rateLimit: {
    enabled: envConfig.RATE_LIMIT_ENABLED === 'true',
    max: parseInt(envConfig.RATE_LIMIT_MAX, 10),
    window: envConfig.RATE_LIMIT_WINDOW
  },
  
  fraud: {
    enabled: envConfig.FRAUD_DETECTION_ENABLED === 'true',
    maxRiskScore: parseFloat(envConfig.FRAUD_MAX_RISK_SCORE),
    blockThreshold: parseFloat(envConfig.FRAUD_BLOCK_THRESHOLD),
    reviewThreshold: parseFloat(envConfig.FRAUD_REVIEW_THRESHOLD)
  },
  
  logging: {
    level: envConfig.LOG_LEVEL,
    pretty: envConfig.LOG_PRETTY === 'true'
  },
  
  security: {
    cors: {
      origin: envConfig.CORS_ORIGIN
    },
    currencies: {
      allowed: envConfig.ALLOWED_CURRENCIES.split(','),
      blocked: envConfig.BLOCKED_CURRENCIES.split(',')
    }
  }
};

// Freeze config to prevent modifications
Object.freeze(config);
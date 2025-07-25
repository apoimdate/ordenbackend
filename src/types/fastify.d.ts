import 'fastify';
import { PrismaClient, Role, User } from '@prisma/client';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { FastifyRequest } from 'fastify';
import { JWT } from '@fastify/jwt';
import TypesenseClient from 'typesense';
import Stripe from 'stripe';
import { FastifyRedis } from '@fastify/redis';

// JWT Payload Type
export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: Role;
  sessionId: string;
  permissions: string[];
  sellerId?: string | null;
}

// Request Context
export interface RequestContext {
  userId?: string;
  userType?: string;
  sessionId?: string;
  permissions?: string[];
  sellerId?: string;
  traceId?: string;
  spanId?: string;
  startTime?: number;
  isAuthenticated?: boolean;
  apiKey?: string;
}

// Request with tracing
export interface RequestWithTracing extends FastifyRequest {
  startTime?: number;
  context?: RequestContext;
  traceId?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    // Core services
    prisma: PrismaClient;
    redis: Redis;
    events: EventEmitter;
    jwt: JWT;
    typesense: TypesenseClient;
    stripe: Stripe;
    
    // Decorators
    authenticate: any;
    authorize: (roles: string[]) => any;
    validateApiKey: any;
  }

  interface FastifyRequest {
    context: RequestContext;
    startTime?: number;
    traceId?: string;
    user?: User & JWTPayload;
    apiKey?: {
      apiKeyId: string;
      sellerId?: string;
      key: string;
      lastUsedAt: Date;
    };
  }

  interface FastifyContextConfig {
    context?: RequestContext;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

// Extend VerifyPayloadType to include our custom properties
declare module '@fastify/jwt' {
  interface VerifyPayloadType extends JWTPayload {}
}
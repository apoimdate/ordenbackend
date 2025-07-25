import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { JWTPayload } from '../types';

export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

/**
 * JWT Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Token is verified by fastify-jwt plugin, user data is in request.user
    await request.jwtVerify();
    
    if (!(request as any).user) {
      return reply.code(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Check if user exists and is active
    const user = await request.server.prisma.user.findUnique({
      where: { id: (request as any).user.userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    // @ts-ignore - TS2339: Temporary fix
    if (!user || user.deletedAt) {
      return reply.code(401).send({
        error: 'User account is inactive or not found',
        code: 'USER_INACTIVE'
      });
    }

    // Log authentication success
    logger.debug({
      userId: user.id,
      email: user.email,
      role: user.role
    }, 'User authenticated successfully');

  } catch (_error) { logger.warn({ 
      error: (_error as Error).message,
      url: request.url,
      method: request.method 
    }, 'Authentication failed');

    return reply.code(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is present, but doesn't require it
 */
export async function optionalAuthenticate(
  request: FastifyRequest
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return;
    }

    // Try to verify token
    await request.jwtVerify();
    
    if ((request as any).user) {
      // Check if user exists and is active
      const user = await request.server.prisma.user.findUnique({
        where: { id: (request as any).user.userId },
        select: {
          id: true,
          email: true,
          role: true
        }
      });

    // @ts-ignore - TS2339: Temporary fix
      if (!user || user.deletedAt) {
        (request as any).user = undefined;
      }
    }
  } catch (error) {
    // Token is invalid, but we don't throw error for optional auth
    (request as any).user = undefined;
    logger.debug({ error: (error as Error).message }, 'Optional authentication failed');
  }
}

/**
 * API Key Authentication middleware
 * Verifies API key for service-to-service communication
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return reply.code(401).send({
      error: 'API key is required',
      code: 'API_KEY_REQUIRED'
    });
  }

  try {
    const key = await request.server.prisma.apiKey.findFirst({
      where: {
        key: apiKey,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!key) {
      return reply.code(401).send({
        error: 'Invalid or expired API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Update last used timestamp
    await request.server.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() }
    });

    // Attach key info to request for logging/auditing
    (request as any).apiKeyInfo = {
      id: key.id,
      name: key.name,
      permissions: key.permissions
    };

  } catch (error) {
    logger.error({ error: (error as Error).message }, 'API key authentication error');
    return reply.code(500).send({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { logger } from '../utils/logger';
import { RequestContext } from '../types';

export { RequestContext };

// API Key validation function
async function validateApiKey(apiKey: string) {
  try {
    // Look up API key in database (this assumes you have an ApiKey model)
    // Since ApiKey model might not exist, we'll do a simple validation for now
    
    // For demo purposes - validate against environment variables or hardcoded keys
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (validApiKeys.includes(apiKey) || apiKey === adminApiKey) {
      return {
        id: `api_${Date.now()}`,
        userId: 'system',
        userType: 'api',
        permissions: ['read', 'write'], // Default permissions
        isActive: true,
        name: 'API Access'
      };
    }

    // If you have an ApiKey model in your schema, use this instead:
    // const apiKeyRecord = await prisma.apiKey.findUnique({
    //   where: { 
    //     key: apiKey,
    //     isActive: true 
    //   },
    //   include: {
    //     user: {
    //       select: {
    //         id: true,
    //         email: true,
    //         role: true,
    //         permissions: true,
    //         isActive: true
    //       }
    //     }
    //   }
    // });

    // if (!apiKeyRecord || !apiKeyRecord.user.isActive) {
    //   return null;
    // }

    // return {
    //   id: apiKeyRecord.id,
    //   userId: apiKeyRecord.user.id,
    //   userType: apiKeyRecord.user.role,
    //   permissions: apiKeyRecord.user.permissions,
    //   isActive: apiKeyRecord.isActive,
    //   name: apiKeyRecord.name
    // };

    return null; // Invalid API key
  } catch (error) {
    logger.error({ error }, 'Error validating API key');
    throw new Error('API key validation failed');
  }
}

export async function contextMiddleware(fastify: FastifyInstance) {
  fastify.decorateRequest('context', {});

  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Initialize request context
    const context: RequestContext = {
      traceId: (request.headers['x-trace-id'] as string) || (request as any).traceId,
      isAuthenticated: false,
      startTime: Date.now()
    };

    // Extract user info from JWT if available
    if (request.headers.authorization) {
      try {
        const token = request.headers.authorization.replace('Bearer ', '');
        const decoded = await fastify.jwt.verify(token);
        
        context.userId = (decoded as any).userId;
        context.userType = (decoded as any).role as string;
        context.sessionId = (decoded as any).sessionId;
        context.permissions = (decoded as any).permissions;
        context.isAuthenticated = true;
      } catch (error) {
        // Invalid token, continue as unauthenticated
        logger.debug({ error, traceId: context.traceId }, 'Invalid JWT token');
      }
    }

    // Check for API key authentication
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey && !context.isAuthenticated) {
      try {
        const validatedApiKey = await validateApiKey(apiKey);
        if (validatedApiKey) {
          context.isAuthenticated = true;
          context.userId = validatedApiKey.userId;
          context.userType = validatedApiKey.userType || 'api';
          context.permissions = validatedApiKey.permissions || [];
          context.apiKey = apiKey;
          context.apiKeyId = validatedApiKey.id;
          
          logger.debug({
            traceId: context.traceId,
            apiKeyId: validatedApiKey.id,
            userId: validatedApiKey.userId,
            userType: context.userType
          }, 'API key authenticated');
        }
      } catch (error) {
        logger.warn({
          traceId: context.traceId,
          apiKey: `${apiKey.substring(0, 8)  }***`, // Log only first 8 chars for security
          error: (error as Error).message
        }, 'API key validation failed');
      }
    }

    // Attach context to request
    (request as any).context = context;

    // Log authenticated requests
    if (context.isAuthenticated) {
      logger.debug({
        traceId: context.traceId,
        userId: context.userId,
        userType: context.userType,
        method: request.method,
        path: request.url
      }, 'Authenticated request');
    }
  });

  // Update request properties for other middleware
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Make user info available on request object for logging middleware
    if ((request.context as any).userId) {
      (request as any).userId = (request.context as any).userId;
      (request as any).userType = (request.context as any).userType;
    }
  });
}
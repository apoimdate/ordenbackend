import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { logger } from '../utils/logger';
import { RequestContext } from '../types';

export { RequestContext };

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
      // TODO: Validate API key and set context
      context.apiKey = apiKey;
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
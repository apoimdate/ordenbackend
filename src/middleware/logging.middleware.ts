import { FastifyReply, FastifyInstance } from 'fastify';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';
import { PrismaClient } from '@prisma/client';

export async function loggingMiddleware(
  fastify: FastifyInstance,
  prisma: PrismaClient
) {
  // Request ID generation
  fastify.addHook('onRequest', async (request: any, reply: any) => {
    // Generate unique trace ID for this request
    (request as any).traceId = request.headers['x-trace-id'] as string || nanoid(16);
    
    // Set trace ID in response headers
    reply.header('x-trace-id', (request as any).traceId);
    
    // Log request start
    logger.info({
      traceId: request.traceId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      referer: request.headers.referer,
      correlationId: request.headers['x-correlation-id']
    }, 'Request started');
  });

  // Request body logging (excluding sensitive data)
  fastify.addHook('preHandler', async (request: any, _reply: any) => {
    if (request.body && Object.keys(request.body).length > 0) {
      const sanitizedBody = sanitizeRequestBody(request.body);
      
      logger.debug({
        traceId: request.traceId,
        body: sanitizedBody,
        contentType: request.headers['content-type']
      }, 'Request body');
    }
  });

  // Response logging
  fastify.addHook('onSend', async (request: any, reply: any, payload: any) => {
    const responseTime = Date.now() - ((request as any).startTime || Date.now());
    
    logger.info({
      traceId: request.traceId,
      statusCode: reply.statusCode,
      responseTime,
      method: request.method,
      url: request.url,
      userId: (request as any).userId,
      userType: (request as any).userType
    }, 'Request completed');

    // Log to audit database for specific operations
    if (shouldAuditLog(request, reply)) {
      await logToAuditDatabase(prisma, request, reply, responseTime);
    }

    // Log errors
    if (reply.statusCode >= 400) {
      logger.error({
        traceId: request.traceId,
        statusCode: reply.statusCode,
        method: request.method,
        url: request.url,
        error: payload,
        body: sanitizeRequestBody(request.body),
        query: request.query,
        params: request.params
      }, 'Request failed');
    }
  });

  // Error logging
  fastify.setErrorHandler(async (error: any, request: any, reply: any) => {
    const errorId = nanoid(16);
    
    logger.error({
      errorId,
      traceId: request.traceId,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode
      },
      method: request.method,
      url: request.url,
      userId: (request as any).userId
    }, 'Unhandled error');

    // Log to error database
    try {
      // @ts-ignore
      await prisma.apiRequestLog.create({
        data: {
          id: (request as any).traceId || nanoid(16),
          method: request.method,
          path: request.url,
          ipAddress: request.ip,
          statusCode: error.statusCode || 500,
          responseTime: 0,
        }
      });
    } catch (dbError) {
      logger.error({ dbError }, 'Failed to log error to database');
    }

    reply.status(error.statusCode || 500).send({
      error: {
        id: errorId,
        message: process.env.NODE_ENV === 'production' 
          ? 'Internal Server Error' 
          : error.message,
        code: error.code,
        statusCode: error.statusCode || 500,
        timestamp: new Date().toISOString()
      }
    });
  });
}

// Sanitize request body to remove sensitive information
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = [
    'password',
    'newPassword',
    'oldPassword',
    'confirmPassword',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
    'bankAccount',
    'privateKey'
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }

  return sanitized;
}

// Sanitize headers to remove sensitive information
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  for (const header of sensitiveHeaders) {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  }

  return sanitized;
}

// Determine if request should be logged to audit database
function shouldAuditLog(request: any, reply: FastifyReply): boolean {
  // Always audit certain operations
  const auditPaths = [
    '/api/auth',
    '/api/payments',
    '/api/orders',
    '/api/admin',
    '/api/sellers/payout',
    '/api/users/delete',
    '/api/settings'
  ];

  const auditMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Audit if it's a modification operation
  if (auditMethods.includes(request.method)) {
    return true;
  }

  // Audit specific paths
  if (auditPaths.some(path => request.url.startsWith(path))) {
    return true;
  }

  // Audit failed authentication attempts
  if (reply.statusCode === 401) {
    return true;
  }

  return false;
}

// Log to audit database
async function logToAuditDatabase(
  prisma: PrismaClient,
  request: any,
  reply: FastifyReply,
  responseTime: number
) {
  try {
    const auditData: any = {
      traceId: request.traceId,
      userId: (request as any).userId,
      userType: (request as any).userType,
      action: `${request.method} ${request.url}`,
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      responseTime,
      ip: request.ip,
      userAgent: request.headers['user-agent'] as string,
      requestBody: JSON.stringify(sanitizeRequestBody(request.body)),
      requestHeaders: JSON.stringify(sanitizeHeaders(request.headers))
    };

    // Route to appropriate audit table based on user type
    switch (request.userType) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        // @ts-ignore
        // await prisma.adminActionLog.create({
        //   data: {
        //     adminId: request.userId!,
        //     action: auditData.action,
        //     entity: extractResource(request.url),
        //     entityId: 'unknown',
        //     changes: auditData,
        //     ipAddress: auditData.ip,
        //     userAgent: auditData.userAgent,
        //   }
        // });
        break;
      
      case 'SELLER':
        // @ts-ignore
        // await prisma.adminActionLog.create({
        //   data: {
        //     adminId: request.userId!,
        //     action: auditData.action,
        //     entity: extractResource(request.url),
        //     entityId: 'unknown',
        //     changes: auditData,
        //     ipAddress: auditData.ip,
        //     userAgent: auditData.userAgent,
        //   }
        // });
        break;
      
      case 'USER':
        // @ts-ignore
        await prisma.userActivityLog.create({
          data: {
            userId: request.userId!,
            activity: auditData.action,
            ipAddress: auditData.ip,
            userAgent: auditData.userAgent,
          }
        });
        break;
      
      default:
        // Log anonymous actions to API request log
        // @ts-ignore
        await prisma.apiRequestLog.create({
          data: {
            id: (request as any).traceId || nanoid(16),
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
            responseTime,
            ipAddress: request.ip,
          }
        });
    }
  } catch (_error) { logger.error({ error: _error }, 'Failed to write audit log');
  }
}

// Performance monitoring middleware
export async function performanceMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: any, _reply: any) => {
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onSend', async (request: any, reply: any, _payload: any) => {
    const responseTime = Date.now() - ((request as any).startTime || Date.now());
    
    // Add response time header
    reply.header('x-response-time', `${responseTime}ms`);
    
    // Log slow requests
    if (responseTime > 1000) {
      logger.warn({
        traceId: request.traceId,
        method: request.method,
        url: request.url,
        responseTime,
        threshold: 1000
      }, 'Slow request detected');
    }
  });
}

// Security headers middleware
export async function securityHeadersMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onSend', async (_request: any, reply: any, _payload: any) => {
    reply.header('x-frame-options', 'DENY');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-xss-protection', '1; mode=block');
    reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    reply.header('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self';");
  });
}

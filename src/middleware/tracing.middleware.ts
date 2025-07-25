import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AsyncLocalStorage } from 'async_hooks';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';

// Trace context that will be available throughout the request lifecycle
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  userId?: string;
  userType?: string;
  correlationId?: string;
  startTime: number;
  attributes: Record<string, any>;
}

// Global async local storage for trace context
export const traceStorage = new AsyncLocalStorage<TraceContext>();

// Get current trace context
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

// Create a new span within the current trace
export function createSpan(name: string, attributes?: Record<string, any>): {
  spanId: string;
  end: (attributes?: Record<string, any>) => void;
} {
  const context = getTraceContext();
  const spanId = nanoid(8);
  const startTime = Date.now();

  if (context) {
    logger.debug({
      traceId: context.traceId,
      parentSpanId: context.spanId,
      spanId,
      name,
      attributes
    }, 'Span started');
  }

  return {
    spanId,
    end: (endAttributes?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      
      if (context) {
        logger.debug({
          traceId: context.traceId,
          parentSpanId: context.spanId,
          spanId,
          name,
          duration,
          attributes: { ...attributes, ...endAttributes }
        }, 'Span ended');
      }
    }
  };
}

// Tracing middleware
export async function tracingMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract or generate trace ID
    const traceId = (request.headers['x-trace-id'] as string) || nanoid(16);
    const parentSpanId = request.headers['x-span-id'] as string;
    const correlationId = request.headers['x-correlation-id'] as string;
    
    // Create trace context
    const context: TraceContext = {
      traceId,
      spanId: nanoid(8),
      parentSpanId,
      correlationId,
      startTime: Date.now(),
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.target': request.url,
        'http.host': request.hostname,
        'http.scheme': request.protocol,
        'http.user_agent': request.headers['user-agent'],
        'net.peer.ip': request.ip
      }
    };

    // Run the rest of the request in the trace context
    // @ts-ignore - TS2345: Temporary fix
    await traceStorage.run(context, async () => {
      // Set trace headers in response
      reply.header('x-trace-id', traceId);
      reply.header('x-span-id', context.spanId);
      
      // Attach context to request for other middleware
      (request as any).traceContext = context;
    });
  });

  // Add request completion tracing
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = (request as any).traceContext as TraceContext;
    
    if (context) {
      const duration = Date.now() - context.startTime;
      
      // Add response attributes
      context.attributes['http.status_code'] = reply.statusCode;
      context.attributes['http.response_size'] = reply.getHeader('content-length');
      context.attributes['duration_ms'] = duration;
      
      // Log the complete trace
      logger.info({
        traceId: context.traceId,
        spanId: context.spanId,
        parentSpanId: context.parentSpanId,
        correlationId: context.correlationId,
        duration,
        attributes: context.attributes
      }, 'Request trace completed');
      
      // Log to performance metrics if needed
      if (duration > 1000) {
        await logPerformanceMetric(context, duration);
      }
    }
  });

  // Add error tracing
  fastify.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const context = (request as any).traceContext as TraceContext;
    
    if (context) {
      logger.error({
        traceId: context.traceId,
        spanId: context.spanId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        attributes: context.attributes
      }, 'Request trace failed');
    }
  });
}

// Log performance metrics for monitoring
async function logPerformanceMetric(context: TraceContext, duration: number) {
  try {
    // This would typically send to a monitoring service
    // For now, just log it
    logger.warn({
      traceId: context.traceId,
      metric: 'slow_request',
      duration,
      threshold: 1000,
      method: context.attributes['http.method'],
      path: context.attributes['http.url']
    }, 'Performance threshold exceeded');
  } catch (_error) { logger.error({ error: _error }, 'Failed to log performance metric');
  }
}

// Utility functions for manual tracing

// Trace a function execution
export async function traceFunction<T>(name: string, fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const span = createSpan(name, attributes);
  
  try {
    const result = await fn();
    span.end({ status: 'success' });
    return result;
  } catch (error) {
    span.end({ 
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// Trace a database operation
export async function traceDatabase<T>(operation: string, model: string, fn: () => Promise<T>
): Promise<T> {
  return traceFunction(`db.${operation}`, fn, {
    'db.operation': operation,
    'db.model': model,
    'db.system': 'postgresql'
  });
}

// Trace an external API call
export async function traceHttpCall<T>(method: string, url: string, fn: () => Promise<T>
): Promise<T> {
  return traceFunction(`http.${method}`, fn, {
    'http.method': method,
    'http.url': url,
    'span.kind': 'client'
  });
}

// Trace cache operations
export async function traceCache<T>(operation: string, key: string, fn: () => Promise<T>
): Promise<T> {
  return traceFunction(`cache.${operation}`, fn, {
    'cache.operation': operation,
    'cache.key': key,
    'cache.system': 'redis'
  });
}

// Distributed tracing headers for outgoing requests
export function getTracingHeaders(): Record<string, string> {
  const context = getTraceContext();
  
  if (!context) {
    return {};
  }

  return {
    'x-trace-id': context.traceId,
    'x-parent-span-id': context.spanId,
    'x-correlation-id': context.correlationId || context.traceId
  };
}

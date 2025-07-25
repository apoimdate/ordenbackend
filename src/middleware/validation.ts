import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Request validation middleware using Zod schemas
 */
export function validateRequest(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validationTarget = {
        body: request.body,
        query: request.query,
        params: request.params,
        headers: request.headers
      };

      // Validate the request against the schema
      const validated = schema.parse(validationTarget);
      
      // Update request with validated data
      if (validated.body !== undefined) {
        request.body = validated.body;
      }
      if (validated.query !== undefined) {
        request.query = validated.query;
      }
      if (validated.params !== undefined) {
        request.params = validated.params;
      }

    } catch (error: any) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: (err as any).received || 'unknown'
        }));

        logger.warn({
          url: request.url,
          method: request.method,
          validationErrors
        }, 'Request validation failed');

        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        });
      }

      // Other validation errors
      logger.error({
        error: (error as Error).message,
        url: request.url,
        method: request.method
      }, 'Unexpected validation error');

      return reply.code(500).send({
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * File upload validation middleware
 */
export function validateFileUpload(options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
  required?: boolean;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
      required = false
    } = options;

    try {
      const data = await request.file();
      
      if (!data) {
        if (required) {
          return reply.code(400).send({
            error: 'File upload is required',
            code: 'FILE_REQUIRED'
          });
        }
        return; // No file uploaded, but not required
      }

      // Check file size
      if (data.file.bytesRead > maxSize) {
        return reply.code(400).send({
          error: `File size exceeds maximum allowed size of ${maxSize} bytes`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Check file type
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({
          error: `File type ${data.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE'
        });
      }

      // Attach file data to request for processing
      (request as any).uploadedFile = data;

    } catch (error: any) {
      logger.error({
        error: (error as Error).message,
        url: request.url,
        method: request.method
      }, 'File upload validation failed');

      return reply.code(400).send({
        error: 'File upload validation failed',
        code: 'FILE_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Multipart file upload validation for multiple files
 */
export function validateMultipleFileUpload(options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
  required?: boolean;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
      maxFiles = 5,
      required = false
    } = options;

    try {
      const parts = request.parts();
      const uploadedFiles: any[] = [];
      let fileCount = 0;

      for await (const part of parts) {
        if (part.type === 'file') {
          fileCount++;

          // Check max files limit
          if (fileCount > maxFiles) {
            return reply.code(400).send({
              error: `Maximum ${maxFiles} files allowed`,
              code: 'TOO_MANY_FILES'
            });
          }

          // Check file size
          if (part.file.bytesRead > maxSize) {
            return reply.code(400).send({
              error: `File ${part.filename} exceeds maximum size of ${maxSize} bytes`,
              code: 'FILE_TOO_LARGE'
            });
          }

          // Check file type
          if (!allowedTypes.includes(part.mimetype)) {
            return reply.code(400).send({
              error: `File type ${part.mimetype} for ${part.filename} is not allowed`,
              code: 'INVALID_FILE_TYPE'
            });
          }

          uploadedFiles.push(part);
        } else {
          // Handle form fields
          (request.body as any) = (request.body as any) || {};
          (request.body as any)[part.fieldname] = part.value;
        }
      }

      if (required && uploadedFiles.length === 0) {
        return reply.code(400).send({
          error: 'At least one file is required',
          code: 'FILES_REQUIRED'
        });
      }

      // Attach files to request
      (request as any).uploadedFiles = uploadedFiles;

    } catch (error: any) {
      logger.error({
        error: (error as Error).message,
        url: request.url,
        method: request.method
      }, 'Multiple file upload validation failed');

      return reply.code(400).send({
        error: 'File upload validation failed',
        code: 'FILE_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Query parameter sanitization middleware
 */
export function sanitizeQuery(allowedParams: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = request.query as Record<string, any>;
    const sanitizedQuery: Record<string, any> = {};

    // Only keep allowed parameters
    for (const param of allowedParams) {
      if (query[param] !== undefined) {
        sanitizedQuery[param] = query[param];
      }
    }

    request.query = sanitizedQuery;
  };
}

/**
 * API key validation middleware
 */
export function validateApiKey() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      return reply.code(401).send({
        error: 'API key required',
        code: 'API_KEY_REQUIRED'
      });
    }

    try {
      // Validate API key against database
      const validApiKey = await request.server.prisma.apiKey.findUnique({
        where: { key: apiKey, isActive: true }
      });

      if (!validApiKey) {
        return reply.code(401).send({
          error: 'Invalid API key',
          code: 'INVALID_API_KEY'
        });
      }

      // Check rate limits for API key
      const now = new Date();
      const oneHour = new Date(now.getTime() - 60 * 60 * 1000);
      
      // @ts-ignore
      const recentRequests = await request.server.prisma.apiRequestLog.count({
        where: {
          createdAt: { gte: oneHour }
        }
      });

      if (recentRequests >= 1000) { // Default rate limit
        return reply.code(429).send({
          error: 'API rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }

      // Log API request
      await request.server.prisma.apiRequestLog.create({
        data: {
          path: request.url,
          method: request.method,
          ipAddress: request.ip,
          statusCode: 200,
          responseTime: 0
        }
      });

      // Attach API key info to request
      (request as any).apiKey = validApiKey;

    } catch (error: any) {
      logger.error({
        error: (error as Error).message,
        apiKey: apiKey.substring(0, 8) + '...',
        url: request.url
      }, 'API key validation failed');

      return reply.code(500).send({
        error: 'API key validation error',
        code: 'API_KEY_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * CSRF protection middleware
 */
export function csrfProtection() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // This is a placeholder for a real CSRF implementation
    // A real implementation would use a library like `fastify-csrf`
    // and check for a valid CSRF token in headers/body
    
    // @ts-ignore
    const csrfToken = request.headers['x-csrf-token'] as string;
    // @ts-ignore
    const sessionToken = (request.session as any)?.csrfToken;

    if (request.method !== 'GET' && (!csrfToken || csrfToken !== sessionToken)) {
      return reply.code(403).send({
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
    }
  };
}

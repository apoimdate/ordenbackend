export class ApiError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common API Errors
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', true);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS', true);
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}

export class BadGatewayError extends ApiError {
  constructor(message: string = 'Bad gateway') {
    super(message, 502, 'BAD_GATEWAY', false);
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', false);
  }
}

// Business Logic Errors
export class InsufficientStockError extends ApiError {
  constructor(productName: string, available: number) {
    super(
      `Insufficient stock for ${productName}. Only ${available} items available.`,
      400,
      'INSUFFICIENT_STOCK',
      true,
      { productName, available }
    );
  }
}

export class PaymentError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'PAYMENT_ERROR', true, details);
  }
}

export class InvalidCouponError extends ApiError {
  constructor(message: string) {
    super(message, 400, 'INVALID_COUPON', true);
  }
}

export class OrderError extends ApiError {
  constructor(message: string, code: string = 'ORDER_ERROR') {
    super(message, 400, code, true);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

export class TokenExpiredError extends ApiError {
  constructor(message: string = 'Token expired') {
    super(message, 401, 'TOKEN_EXPIRED', true);
  }
}

export class InvalidTokenError extends ApiError {
  constructor(message: string = 'Invalid token') {
    super(message, 401, 'INVALID_TOKEN', true);
  }
}

export class PermissionError extends ApiError {
  constructor(action: string, resource: string) {
    super(
      `You don't have permission to ${action} ${resource}`,
      403,
      'PERMISSION_ERROR',
      true
    );
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded',
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { retryAfter }
    );
  }
}

export class InvalidInputError extends ApiError {
  constructor(field: string, message: string) {
    super(
      `Invalid input for ${field}: ${message}`,
      400,
      'INVALID_INPUT',
      true,
      { field }
    );
  }
}

export class DuplicateError extends ApiError {
  constructor(resource: string, field: string, value: string) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      409,
      'DUPLICATE_ERROR',
      true,
      { resource, field, value }
    );
  }
}

export class ExternalServiceError extends ApiError {
  constructor(service: string, message: string) {
    super(
      `External service error (${service}): ${message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      false,
      { service }
    );
  }
}

export class ConfigurationError extends ApiError {
  constructor(message: string) {
    super(message, 500, 'CONFIGURATION_ERROR', false);
  }
}

export class DataIntegrityError extends ApiError {
  constructor(message: string) {
    super(message, 500, 'DATA_INTEGRITY_ERROR', false);
  }
}

// Error handler utility
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function getErrorStatusCode(error: any): number {
  if (isApiError(error)) {
    return error.statusCode;
  }
  return 500;
}

export function getErrorCode(error: any): string {
  if (isApiError(error)) {
    return error.code;
  }
  return 'INTERNAL_ERROR';
}

// Error response formatter
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
  };
}

export function formatErrorResponse(error: any): ErrorResponse {
  if (isApiError(error)) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details
      }
    };
  }

  // Handle Prisma errors
  if (error.code === 'P2002') {
    const target = error.meta?.target;
    return {
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: `Duplicate value for ${target}`,
        statusCode: 409,
        details: { target }
      }
    };
  }

  if (error.code === 'P2025') {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Record not found',
        statusCode: 404
      }
    };
  }

  // Default error response
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500
    }
  };
}
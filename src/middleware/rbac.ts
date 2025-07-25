import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

/**
 * Role-based access control middleware
 * Checks if authenticated user has required roles
 */
export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn({
        userId: user.id,
        userRole: user.role,
        requiredRoles: allowedRoles,
        url: request.url,
        method: request.method
      }, 'Access denied - insufficient permissions');

      return reply.code(403).send({
        error: 'Insufficient permissions',
        code: 'ACCESS_DENIED'
      });
    }

    logger.debug({
      userId: user.id,
      userRole: user.role,
      url: request.url,
      method: request.method
    }, 'Access granted');
  };
}

/**
 * Resource ownership check
 * Verifies that user owns the resource or has admin privileges
 */
export function authorizeOwnership(resourceUserIdField: string = 'userId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Admin and super admin can access any resource
    if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return;
    }

    // Get resource user ID from request params, query, or body
    const resourceUserId = 
      (request.params as any)?.[resourceUserIdField] ||
      (request.query as any)?.[resourceUserIdField] ||
      (request.body as any)?.[resourceUserIdField];

    if (!resourceUserId) {
      return reply.code(400).send({
        error: 'Resource user ID not found in request',
        code: 'RESOURCE_USER_ID_MISSING'
      });
    }

    if (resourceUserId !== user.id) {
      logger.warn({
        userId: user.id,
        resourceUserId,
        url: request.url,
        method: request.method
      }, 'Access denied - resource ownership check failed');

      return reply.code(403).send({
        error: 'Access denied - you can only access your own resources',
        code: 'OWNERSHIP_REQUIRED'
      });
    }
  };
}

/**
 * Seller authorization
 * Checks if user is a seller and optionally owns the seller resource
 */
export function authorizeSeller(checkOwnership: boolean = false) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Check if user is a seller or admin
    if (!['SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return reply.code(403).send({
        error: 'Seller account required',
        code: 'SELLER_REQUIRED'
      });
    }

    // For sellers, check ownership if required
    if (checkOwnership && user.role === 'SELLER') {
      const sellerId = (request.params as any)?.sellerId || (request.query as any)?.sellerId || (request.body as any)?.sellerId;
      
      if (sellerId && sellerId !== user.sellerId) {
        logger.warn({
          userId: user.id,
          userSellerId: user.sellerId,
          requestedSellerId: sellerId,
          url: request.url,
          method: request.method
        }, 'Access denied - seller ownership check failed');

        return reply.code(403).send({
          error: 'Access denied - you can only access your own seller resources',
          code: 'SELLER_OWNERSHIP_REQUIRED'
        });
      }
    }
  };
}

/**
 * Permission-based authorization
 * Checks if user has specific permissions
 */
export function authorizePermissions(requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userPermissions = user.permissions || [];
    const hasAllPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn({
        userId: user.id,
        userPermissions,
        requiredPermissions,
        url: request.url,
        method: request.method
      }, 'Access denied - missing required permissions');

      return reply.code(403).send({
        error: 'Missing required permissions',
        code: 'PERMISSIONS_REQUIRED',
        details: {
          required: requiredPermissions,
          missing: requiredPermissions.filter(p => !userPermissions.includes(p))
        }
      });
    }
  };
}

/**
 * Rate limiting based on user role
 */
export function authorizeRateLimit() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = (request as any).user;
    
    // Rate limits are configured in app.ts and handled by fastify-rate-limit
    // This middleware can be used to apply different limits based on user role
    
    if (!user) {
      // Apply guest rate limit
      (request as any).rateLimitContext = { role: 'GUEST' };
    } else {
      // Apply role-based rate limit
      (request as any).rateLimitContext = { role: user.role, userId: user.id };
    }
  };
}

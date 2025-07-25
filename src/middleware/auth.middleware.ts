import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Token is verified by fastify-jwt, user data is in request.user
    await request.jwtVerify();
    
    // Check if session is still active
    const session = await request.server.prisma.session.findUnique({
      where: { id: request.user!.sessionId }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Session expired or invalid');
    }

    // Attach user to context (using type assertion until context types are fixed)
    (request.context as any).userId = request.user!.userId;
    (request.context as any).userType = request.user!.role as string;
    (request.context as any).sessionId = request.user!.sessionId;
    (request.context as any).isAuthenticated = true;
    (request.context as any).permissions = request.user!.permissions;

  } catch (error) { logger.debug({ error: error, traceId: (request.context as any).traceId }, 'Authentication failed');
    
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }
}

/**
 * Check if user has required role
 */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // First authenticate
    await authenticate(request, reply);
    
    // Then check role
    if (!roles.includes(request.user!.role)) {
      logger.warn({
        userId: request.user!.userId,
        role: request.user!.role,
        requiredRoles: roles,
        traceId: (request.context as any).traceId
      }, 'Access denied - insufficient role');

      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
  };
}

/**
 * Check if user has required permission
 */
export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // First authenticate
    await authenticate(request, reply);
    
    // Check if user has any of the required permissions
    const userPermissions = request.user!.permissions;
    const hasPermission = permissions.some(permission => {
      // Check for wildcard permission
      if (userPermissions.includes('*')) return true;
      
      // Check exact permission
      if (userPermissions.includes(permission)) return true;
      
      // Check wildcard patterns (e.g., 'read:*' matches 'read:products')
      const permissionParts = permission.split(':');
      return userPermissions.some((userPerm: string) => {
        const userPermParts = userPerm.split(':');
        return userPermParts[0] === permissionParts[0] && userPermParts[1] === '*';
      });
    });

    if (!hasPermission) {
      logger.warn({
        userId: request.user!.userId,
        userPermissions,
        requiredPermissions: permissions,
        traceId: (request.context as any).traceId
      }, 'Access denied - insufficient permissions');

      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
  };
}

/**
 * Optional authentication - doesn't fail if not authenticated
 */
export async function optionalAuth(
  request: FastifyRequest
) {
  try {
    await request.jwtVerify();
    
    // Check session
    const session = await request.server.prisma.session.findUnique({
      where: { id: request.user!.sessionId }
    });

    if (session && session.expiresAt > new Date()) {
      // Update context
      (request.context as any).userId = request.user!.userId;
      (request.context as any).userType = request.user!.role;
      (request.context as any).sessionId = request.user!.sessionId;
      (request.context as any).isAuthenticated = true;
      (request.context as any).permissions = request.user!.permissions;
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    logger.debug({ traceId: (request.context as any).traceId }, 'Optional auth - user not authenticated');
  }
}

/**
 * Verify user owns the resource
 */
export function requireOwnership(resourceGetter: (request: FastifyRequest) => Promise<any>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // First authenticate
    await authenticate(request, reply);
    
    try {
      // Get the resource
      const resource = await resourceGetter(request);
      
      if (!resource) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found'
          }
        });
      }

      // Check ownership
      const userId = request.user!.userId;
      const isOwner = resource.userId === userId || 
                      resource.ownerId === userId ||
                      resource.sellerId === userId;

      // Admins can access anything
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role);

      if (!isOwner && !isAdmin) {
        logger.warn({
          userId,
          resourceId: resource.id,
          resourceType: resource.constructor.name,
          traceId: (request.context as any).traceId
        }, 'Access denied - not owner');

        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this resource'
          }
        });
      }

      // Attach resource to request for use in handler
      (request as any).resource = resource;

    } catch (error) { logger.error({
        error: error,
        traceId: (request.context as any).traceId
      }, 'Error checking resource ownership');

      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error checking resource access'
        }
      });
    }
  };
}

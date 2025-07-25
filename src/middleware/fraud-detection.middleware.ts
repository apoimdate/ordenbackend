import { FastifyRequest, FastifyReply } from 'fastify';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { logger } from '../utils/logger';

interface FraudCheckRequest extends FastifyRequest {
  fraudCheck?: {
    score: number;
    passed: boolean;
    requiresReview: boolean;
  };
}

/**
 * Fraud detection middleware for high-risk operations
 */
export function fraudDetectionMiddleware(
  fraudService: FraudDetectionService,
  options: {
    checkType: 'order' | 'payment' | 'registration';
    blockThreshold?: number;
    reviewThreshold?: number;
  } = { checkType: 'order' }
) {
  return async (request: FraudCheckRequest, reply: FastifyReply) => {
    try {
      // Skip fraud check for admin users
      if ((request.context as any)?.userType === 'ADMIN' || (request.context as any)?.userType === 'SUPER_ADMIN') {
        return;
      }

      // Build fraud context
      const context = {
        user: (request.context as any)?.userId ? { id: (request.context as any).userId } : null,
        order: options.checkType === 'order' ? request.body : null,
        payment: options.checkType === 'payment' ? request.body : null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        sessionId: (request.context as any)?.sessionId
      };

      // Skip if no user context
      if (!context.user) {
        logger.warn({
          traceId: (request.context as any)?.traceId,
          checkType: options.checkType
        }, 'Skipping fraud check - no user context');
        return;
      }

      // Perform fraud check
      const result = await fraudService.checkFraud(context as any);

      // Attach result to request
      request.fraudCheck = {
        score: result.score,
        passed: result.passed,
        requiresReview: result.requiresManualReview
      };

      // Block if fraud detected
      if (!result.passed) {
        logger.warn({
          traceId: (request.context as any)?.traceId,
          userId: context.user.id,
          fraudScore: result.score,
          blockedReason: result.blockedReason
        }, 'Transaction blocked by fraud detection');

        return reply.status(403).send({
          error: {
            code: 'FRAUD_DETECTED',
            message: 'This transaction has been flagged for security reasons',
            reference: result.id
          }
        });
      }

      // Add warning header if review required
      if (result.requiresManualReview) {
        reply.header('x-fraud-review', 'true');
        reply.header('x-fraud-score', result.score.toString());
      }

    } catch (_error) { logger.error({
        error: _error,
        traceId: (request.context as any)?.traceId
      }, 'Fraud detection middleware error');

      // Don't block on error, but flag for review
      request.fraudCheck = {
        score: 0.5,
        passed: true,
        requiresReview: true
      };
    }
  };
}

/**
 * Rate limiting based on fraud score
 */
export function fraudBasedRateLimit(
  fraudService: FraudDetectionService
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!(request.context as any)?.userId) {
        return;
      }

      // Get user's fraud score
      const fraudScore = await fraudService.getUserFraudScore((request.context as any).userId);

      // Adjust rate limit based on fraud score
      let rateLimit = 1000; // Default: 1000 requests per hour

      if (fraudScore >= 0.8) {
        rateLimit = 10; // Severe restriction
      } else if (fraudScore >= 0.6) {
        rateLimit = 50; // Heavy restriction
      } else if (fraudScore >= 0.4) {
        rateLimit = 200; // Moderate restriction
      } else if (fraudScore >= 0.2) {
        rateLimit = 500; // Light restriction
      }

      // Apply custom rate limit
      reply.header('x-ratelimit-limit', rateLimit.toString());
      reply.header('x-fraud-score', fraudScore.toFixed(2));

      // Check rate limit
      const key = `ratelimit:fraud:${(request.context as any).userId}`;
      const count = await fraudService['redis'].incr(key);
      
      if (count === 1) {
        await fraudService['redis'].expire(key, 3600); // 1 hour window
      }

      if (count > rateLimit) {
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Your account has been temporarily restricted.',
            retryAfter: 3600
          }
        });
      }

      reply.header('x-ratelimit-remaining', (rateLimit - count).toString());

    } catch (_error) { logger.error({
        error: _error,
        traceId: (request.context as any)?.traceId
      }, 'Fraud-based rate limit error');
      // Continue on error
    }
  };
}

/**
 * IP reputation check middleware
 */
export function ipReputationMiddleware(
  fraudService: FraudDetectionService
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ipReputation = await fraudService.checkIPReputation(request.ip);

      if (!ipReputation) {
        logger.warn({
          traceId: (request.context as any)?.traceId,
          ip: request.ip
        }, 'Request from blocked or suspicious IP');

        return reply.status(403).send({
          error: {
            code: 'IP_BLOCKED',
            message: 'Access denied from this IP address'
          }
        });
      }

    } catch (_error) { logger.error({
        error: _error,
        traceId: (request.context as any)?.traceId
      }, 'IP reputation check error');
      // Continue on error
    }
  };
}

/**
 * Email reputation check for registration
 */
export function emailReputationMiddleware(
  fraudService: FraudDetectionService
) {
  return async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
    try {
      const { email } = request.body;
      
      if (!email) {
        return;
      }

      const emailReputation = await fraudService.checkEmailReputation(email);

      if (!emailReputation) {
        logger.warn({
          traceId: (request.context as any)?.traceId,
          email
        }, 'Registration attempt with blocked email');

        return reply.status(403).send({
          error: {
            code: 'EMAIL_BLOCKED',
            message: 'This email address cannot be used for registration'
          }
        });
      }

    } catch (_error) { logger.error({
        error: _error,
        traceId: (request.context as any)?.traceId
      }, 'Email reputation check error');
      // Continue on error
    }
  };
}

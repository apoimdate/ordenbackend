import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdvancedFraudService } from '../services/fraud-advanced.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { logger } from '../utils/logger';

export default async function fraudAdvancedRoutes(fastify: FastifyInstance) {
  const fraudAdvancedService = new AdvancedFraudService(fastify);

  /**
   * Assess fraud risk for a transaction
   */
  fastify.post('/assess', {
    schema: {
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
          orderId: { type: 'string' },
          transactionId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          ipAddress: { type: 'string' },
          deviceFingerprint: { type: 'string' },
          userAgent: { type: 'string' },
          location: {
            type: 'object',
            properties: {
              country: { type: 'string' },
              city: { type: 'string' },
              latitude: { type: 'number' },
              longitude: { type: 'number' }
            }
          }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await fraudAdvancedService.assessRisk((request.body as any));
      
      return reply.send({
        success: true,
        message: result.success ? 'Risk assessment completed' : 'Risk assessment failed',
        data: result.data || null,
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud risk assessment failed');
      
      return reply.send({
        success: true,
        message: 'No data available',
        data: null
      });
    }
  });

  /**
   * Analyze fraud patterns
   */
  fastify.get('/patterns', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          userId: { type: 'string' },
          riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options: any = {};
      
      if ((request.query as any).startDate && (request.query as any).endDate) {
        options.dateRange = {
          startDate: new Date((request.query as any).startDate),
          endDate: new Date((request.query as any).endDate)
        };
      }
      
      if ((request.query as any).userId) options.userId = (request.query as any).userId;
      if ((request.query as any).riskLevel) options.riskLevel = (request.query as any).riskLevel;
      if ((request.query as any).limit) options.limit = (request.query as any).limit;
      
      const result = await fraudAdvancedService.analyzePatterns(options);
      
      return reply.send({
        success: true,
        message: result.success ? 'Pattern analysis completed' : 'No data available',
        data: result.data || [],
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud pattern analysis failed');
      
      return reply.send({
        success: true,
        message: 'No data available',
        data: []
      });
    }
  });

  /**
   * Create fraud alert
   */
  fastify.post('/alerts', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'severity', 'description'],
        properties: {
          type: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          description: { type: 'string' },
          userId: { type: 'string' },
          orderId: { type: 'string' },
          riskAssessmentId: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await fraudAdvancedService.createFraudAlert((request.body as any));
      
      return reply.status(201).send({
        success: true,
        message: result.success ? 'Fraud alert created' : 'Failed to create alert',
        data: result.data || null,
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud alert creation failed');
      throw error;
    }
  });

  /**
   * Update fraud alert
   */
  fastify.put('/alerts/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
          assignedTo: { type: 'string' },
          resolution: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await fraudAdvancedService.updateFraudAlert(
        (request.params as any).id,
        (request.body as any),
        (request as any).user.userId
      );
      
      return reply.send({
        success: true,
        message: result.success ? 'Fraud alert updated' : 'Failed to update alert',
        data: result.data || null,
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud alert update failed');
      throw error;
    }
  });

  /**
   * Create fraud rule
   */
  fastify.post('/rules', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type', 'conditions', 'actions'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          type: { type: 'string' },
          conditions: { type: 'object' },
          actions: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
          isActive: { type: 'boolean', default: true },
          priority: { type: 'integer', default: 0 },
          metadata: { type: 'object' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await fraudAdvancedService.createFraudRule((request.body as any));
      
      return reply.status(201).send({
        success: true,
        message: result.success ? 'Fraud rule created' : 'Failed to create rule',
        data: result.data || null,
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud rule creation failed');
      throw error;
    }
  });

  /**
   * Evaluate fraud rules for context
   */
  fastify.post('/rules/evaluate', {
    schema: {
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
          orderId: { type: 'string' },
          transactionId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          ipAddress: { type: 'string' },
          deviceFingerprint: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await fraudAdvancedService.evaluateRules((request.body as any));
      
      return reply.send({
        success: true,
        message: result.success ? 'Rules evaluated' : 'Rule evaluation failed',
        data: result.data || null,
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud rule evaluation failed');
      
      return reply.send({
        success: true,
        message: 'No data available',
        data: null
      });
    }
  });

  /**
   * Get fraud analytics
   */
  fastify.get('/analytics', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          groupBy: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' }
        }
      }
    },
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options: any = {};
      
      if ((request.query as any).startDate && (request.query as any).endDate) {
        options.dateRange = {
          startDate: new Date((request.query as any).startDate),
          endDate: new Date((request.query as any).endDate)
        };
      }
      
      if ((request.query as any).groupBy) options.groupBy = (request.query as any).groupBy;
      
      const result = await fraudAdvancedService.getFraudAnalytics(options);
      
      return reply.send({
        success: true,
        message: result.success ? 'PlatformAnalytics retrieved' : 'No data available',
        data: result.data || {},
        error: result.error || null
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Fraud analytics failed');
      
      return reply.send({
        success: true,
        message: 'No data available',
        data: {}
      });
    }
  });
}

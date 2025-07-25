import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { CommissionService, CommissionData } from '../services/commission.service';
import { z } from 'zod';

// Validation schemas
const createCommissionSchema = z.object({
  orderId: z.string().min(1),
  sellerId: z.string().min(1),
  rate: z.number().min(0).max(1),
  amount: z.number().min(0).optional(),
  notes: z.string().optional()
});

const updateCommissionSchema = z.object({
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  notes: z.string().optional()
});

const commissionFiltersSchema = z.object({
  sellerId: z.string().optional(),
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

export async function commissionRoutes(fastify: FastifyInstance) {
  const commissionService = new CommissionService(fastify);

  // Admin Routes - Commission Management
  
  // Get all commissions with filters
  fastify.get('/commissions', {
    schema: {
      description: 'Get all commissions with filters (requires admin role)',
      summary: 'Get all commissions',
      tags: ['Admin'],
      querystring: {
        type: 'object',
        properties: {
          sellerId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'paid', 'cancelled'] },
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          minAmount: { type: 'number', minimum: 0 },
          maxAmount: { type: 'number', minimum: 0 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      }
    },
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = commissionFiltersSchema.parse((request.query as any));
      
      const { page, limit, ...filterData } = filters;
      const parsedFilters = {
        ...filterData,
        dateFrom: filterData.dateFrom ? new Date(filterData.dateFrom) : undefined,
        dateTo: filterData.dateTo ? new Date(filterData.dateTo) : undefined
      };

      const result = await commissionService.getCommissions(
        parsedFilters,
        { page, limit }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch commissions'
        });
      }

      return reply.send({
        message: 'Commissions fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching commissions:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get commission by ID
  fastify.get('/commissions/:commissionId', {
    schema: {
      description: 'Get commission details by ID (requires admin role)',
      summary: 'Get commission by ID',
      tags: ['Admin'],
      params: {
        type: 'object',
        required: ['commissionId'],
        properties: {
          commissionId: { type: 'string' }
        }
      }
    },
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commissionId } = (request.params as any);

      const result = await commissionService.getCommission(commissionId);

      if (!result.success) {
        return reply.code(404).send({
          error: result.error?.message || 'Commission not found'
        });
      }

      return reply.send({
        message: 'Commission fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching commission:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Create commission (usually automatic, but manual creation for adjustments)
  fastify.post('/commissions', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const commissionData = createCommissionSchema.parse((request.body as any));

      const result = await commissionService.createCommission(commissionData as CommissionData);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to create commission'
        });
      }

      return reply.code(201).send({
        message: 'Commission created successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error creating commission:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Update commission
  fastify.patch('/admin/commissions/:commissionId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commissionId } = (request.params as any);
      const updateData = updateCommissionSchema.parse((request.body as any));

      const result = await commissionService.updateCommission(commissionId, updateData);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to update commission'
        });
      }

      return reply.send({
        message: 'Commission updated successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error updating commission:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Mark commission as paid
  fastify.patch('/admin/commissions/:commissionId/pay', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commissionId } = (request.params as any);

      const result = await commissionService.markAsPaid(commissionId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to mark commission as paid'
        });
      }

      return reply.send({
        message: 'Commission marked as paid successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error marking commission as paid:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Bulk payment processing
  fastify.post('/commissions/bulk-pay', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commissionIds } = (request.body as any);

      if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
        return reply.code(400).send({
          error: 'Commission IDs array is required'
        });
      }

      const result = await commissionService.processBulkPayment(commissionIds);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to process bulk payment'
        });
      }

      return reply.send({
        message: 'Bulk payment processed successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error processing bulk payment:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get commission statistics
  fastify.get('/commissions/stats', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = commissionFiltersSchema.parse((request.query as any));
      
      const { page, limit, ...filterData } = filters;
      const parsedFilters = {
        ...filterData,
        dateFrom: filterData.dateFrom ? new Date(filterData.dateFrom) : undefined,
        dateTo: filterData.dateTo ? new Date(filterData.dateTo) : undefined
      };

      const result = await commissionService.getCommissionStats(parsedFilters);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch commission statistics'
        });
      }

      return reply.send({
        message: 'Commission statistics fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching commission statistics:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Generate commission report
  fastify.get('/commissions/report', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { format = 'json', ...filters } = (request.query as any);
      
      const parsedFilters = {
        ...filters,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined
      };

      const result = await commissionService.generateCommissionReport(
        parsedFilters,
        format
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to generate report'
        });
      }

      if (format === 'csv') {
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="${result.data.filename}"`);
        return reply.send(result.data.content);
      }

      return reply.send({
        message: 'Commission report generated successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error generating commission report:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Seller Routes - View own commissions

  // Get seller's commissions
  fastify.get('/seller/commissions', {
    preHandler: [authenticate, requireRole('SELLER')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      
      // Get seller ID from user
      const seller = await fastify.prisma.seller.findUnique({
        where: { userId: user.id }
      });

      if (!seller) {
        return reply.code(404).send({
          error: 'Seller profile not found'
        });
      }

      const filters = commissionFiltersSchema.parse((request.query as any));
      const { page, limit, ...filterData } = filters;
      
      const parsedFilters = {
        ...filterData,
        dateFrom: filterData.dateFrom ? new Date(filterData.dateFrom) : undefined,
        dateTo: filterData.dateTo ? new Date(filterData.dateTo) : undefined
      };

      const result = await commissionService.getSellerCommissions(
        seller.id,
        parsedFilters,
        { page, limit }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch commissions'
        });
      }

      return reply.send({
        message: 'Commissions fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching seller commissions:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get seller's commission statistics
  fastify.get('/seller/commissions/stats', {
    preHandler: [authenticate, requireRole('SELLER')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      
      // Get seller ID from user
      const seller = await fastify.prisma.seller.findUnique({
        where: { userId: user.id }
      });

      if (!seller) {
        return reply.code(404).send({
          error: 'Seller profile not found'
        });
      }

      const result = await commissionService.getSellerCommissionStats(seller.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch commission statistics'
        });
      }

      return reply.send({
        message: 'Commission statistics fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching seller commission statistics:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}

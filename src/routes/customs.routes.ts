import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { CustomsService } from '../services/customs.service';
import { z } from 'zod';
import { CustomsStatus } from '@prisma/client';

// Validation schemas
const calculateCustomsSchema = z.object({
  countryFrom: z.string().length(2),
  countryTo: z.string().length(2),
  totalValue: z.number().min(0),
  currency: z.enum(['USD', 'EUR']),
  weight: z.number().min(0).optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    description: z.string(),
    hsCode: z.string().optional(),
    weight: z.number().min(0).optional()
  }))
});

const createDeclarationSchema = z.object({
  orderId: z.string().min(1),
  countryFrom: z.string().length(2),
  countryTo: z.string().length(2),
  description: z.string().min(1),
  hsCode: z.string().optional(),
  weight: z.number().min(0).optional(),
  notes: z.string().optional()
});

const updateDeclarationSchema = z.object({
  status: z.nativeEnum(CustomsStatus).optional(),
  customsDuty: z.number().min(0).optional(),
  vat: z.number().min(0).optional(),
  handlingFee: z.number().min(0).optional(),
  notes: z.string().optional()
});

const customsItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().min(1),
  unitValue: z.number().min(0),
  description: z.string().min(1),
  hsCode: z.string().optional(),
  weight: z.number().min(0).optional()
});

const customsFiltersSchema = z.object({
  status: z.nativeEnum(CustomsStatus).optional(),
  countryFrom: z.string().length(2).optional(),
  countryTo: z.string().length(2).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

export async function customsRoutes(fastify: FastifyInstance) {
  const customsService = new CustomsService(fastify);

  // Public Routes - Customs Fee Calculation

  /**
   * Calculate customs fees for an order
   * @route POST /api/customs/calculate
   * @access Public
   * @description Calculate estimated customs fees for international orders
   */
  fastify.post('/customs/calculate', async (request: FastifyRequest, reply) => {
    try {
      const calculationData = calculateCustomsSchema.parse((request.body as any));

      const result = await customsService.calculateCustomsFees(calculationData);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to calculate customs fees'
        });
      }

      return reply.send({
        message: 'Customs fees calculated successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error calculating customs fees:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Customer Routes - View own customs declarations

  /**
   * Get customs declaration for an order
   * @route GET /api/orders/:orderId/customs
   * @access Customer (order owner)
   * @description Get customs declaration for a specific order
   */
  fastify.get('/orders/:orderId/customs', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { orderId } = (request.params as any);

      // Verify order ownership
      const order = await fastify.prisma.order.findFirst({
        where: {
          id: orderId,
          userId: user.id
        }
      });

      if (!order) {
        return reply.code(404).send({
          error: 'Order not found or access denied'
        });
      }

      const result = await customsService.getDeclarationByOrder(orderId);

      if (!result.success) {
        return reply.code(404).send({
          error: result.error?.message || 'Customs declaration not found'
        });
      }

      return reply.send({
        message: 'Customs declaration fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching customs declaration:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Admin Routes - Customs Management

  /**
   * Get all customs declarations
   * @route GET /api/admin/customs
   * @access Admin, Super Admin
   * @description Get all customs declarations with filters
   */
  fastify.get('/admin/customs', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const filters = customsFiltersSchema.parse((request.query as any));
      
      const { page, limit, ...filterData } = filters;
      const parsedFilters = {
        ...filterData,
        dateFrom: filterData.dateFrom ? new Date(filterData.dateFrom) : undefined,
        dateTo: filterData.dateTo ? new Date(filterData.dateTo) : undefined
      };

      const result = await customsService.getDeclarations(
        parsedFilters,
        { page, limit }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch customs declarations'
        });
      }

      return reply.send({
        message: 'Customs declarations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching customs declarations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get customs declaration by ID
   * @route GET /api/admin/customs/:declarationId
   * @access Admin, Super Admin
   * @description Get detailed customs declaration information
   */
  fastify.get('/admin/customs/:declarationId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { declarationId } = (request.params as any);

      const result = await customsService.getDeclaration(declarationId);

      if (!result.success) {
        return reply.code(404).send({
          error: result.error?.message || 'Customs declaration not found'
        });
      }

      return reply.send({
        message: 'Customs declaration fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching customs declaration:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Create customs declaration
   * @route POST /api/admin/customs
   * @access Admin, Super Admin
   * @description Create a new customs declaration for an order
   */
  fastify.post('/admin/customs', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const declarationData = createDeclarationSchema.parse((request.body as any));

      const result = await customsService.createDeclaration(declarationData);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to create customs declaration'
        });
      }

      return reply.code(201).send({
        message: 'Customs declaration created successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error creating customs declaration:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update customs declaration
   * @route PATCH /api/admin/customs/:declarationId
   * @access Admin, Super Admin
   * @description Update customs declaration details
   */
  fastify.patch('/admin/customs/:declarationId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { declarationId } = (request.params as any);
      const updateData = updateDeclarationSchema.parse((request.body as any));

      const result = await customsService.updateDeclaration(declarationId, updateData);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to update customs declaration'
        });
      }

      return reply.send({
        message: 'Customs declaration updated successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error updating customs declaration:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update customs declaration status
   * @route PATCH /api/admin/customs/:declarationId/status
   * @access Admin, Super Admin
   * @description Update the status of a customs declaration
   */
  fastify.patch('/admin/customs/:declarationId/status', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { declarationId } = (request.params as any);
      const { status, notes } = (request.body as any);

      if (!status) {
        return reply.code(400).send({
          error: 'Status is required'
        });
      }

      const result = await customsService.updateDeclarationStatus(
        declarationId,
        status,
        { notes }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to update customs declaration status'
        });
      }

      return reply.send({
        message: 'Customs declaration status updated successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error updating customs declaration status:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get pending customs declarations
   * @route GET /api/admin/customs/pending
   * @access Admin, Super Admin
   * @description Get all pending customs declarations requiring action
   */
  fastify.get('/admin/customs/pending', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (_request: FastifyRequest, reply) => {
    try {
      const result = await customsService.getPendingDeclarations();

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch pending declarations'
        });
      }

      return reply.send({
        message: 'Pending customs declarations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching pending declarations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Add item to customs declaration
   * @route POST /api/admin/customs/:declarationId/items
   * @access Admin, Super Admin
   * @description Add a new item to an existing customs declaration
   */
  fastify.post('/admin/customs/:declarationId/items', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { declarationId } = (request.params as any);
      const itemData = customsItemSchema.parse((request.body as any));

      const result = await customsService.addCustomsItem({
        declarationId,
        ...itemData
      });

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to add customs item'
        });
      }

      return reply.code(201).send({
        message: 'Customs item added successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error adding customs item:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update customs item
   * @route PATCH /api/admin/customs/items/:itemId
   * @access Admin, Super Admin
   * @description Update an existing customs item
   */
  fastify.patch('/admin/customs/items/:itemId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { itemId } = (request.params as any);
      const updateData = (request.body as any);

      const result = await customsService.updateCustomsItem(itemId, updateData);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to update customs item'
        });
      }

      return reply.send({
        message: 'Customs item updated successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error updating customs item:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Remove customs item
   * @route DELETE /api/admin/customs/items/:itemId
   * @access Admin, Super Admin
   * @description Remove an item from a customs declaration
   */
  fastify.delete('/admin/customs/items/:itemId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { itemId } = (request.params as any);

      const result = await customsService.removeCustomsItem(itemId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to remove customs item'
        });
      }

      return reply.send({
        message: 'Customs item removed successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error removing customs item:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get customs statistics
   * @route GET /api/admin/customs/stats
   * @access Admin, Super Admin
   * @description Get customs declaration statistics
   */
  fastify.get('/admin/customs/stats', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const filters = customsFiltersSchema.parse((request.query as any));
      
      const { page, limit, ...filterData } = filters;
      const parsedFilters = {
        ...filterData,
        dateFrom: filterData.dateFrom ? new Date(filterData.dateFrom) : undefined,
        dateTo: filterData.dateTo ? new Date(filterData.dateTo) : undefined
      };

      const result = await customsService.getDeclarationStats(parsedFilters);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch customs statistics'
        });
      }

      return reply.send({
        message: 'Customs statistics fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching customs statistics:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get trade statistics
   * @route GET /api/admin/customs/trade-stats
   * @access Admin, Super Admin
   * @description Get country-to-country trade statistics
   */
  fastify.get('/admin/customs/trade-stats', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { dateFrom, dateTo } = (request.query as any);
      
      const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
      const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

      const result = await customsService.getTradeStats(parsedDateFrom, parsedDateTo);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch trade statistics'
        });
      }

      return reply.send({
        message: 'Trade statistics fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching trade statistics:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Generate customs report
   * @route GET /api/admin/customs/report
   * @access Admin, Super Admin
   * @description Generate customs declaration report in JSON or CSV format
   */
  fastify.get('/admin/customs/report', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { format = 'json', ...filters } = (request.query as any);
      
      const parsedFilters = {
        ...filters,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined
      };

      const result = await customsService.generateCustomsReport(
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
        message: 'Customs report generated successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error generating customs report:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}

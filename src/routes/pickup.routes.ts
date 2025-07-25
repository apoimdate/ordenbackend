import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { PickupService } from '../services/pickup.service';
import { z } from 'zod';

// Validation schemas
const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2)
});

const operatingHoursSchema = z.record(
  z.string(),
  z.object({
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
  })
);

const createPickupLocationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['STORE', 'WAREHOUSE', 'PARTNER', 'LOCKER']),
  address: addressSchema,
  phone: z.string().min(1),
  email: z.string().email().optional(),
  operatingHours: operatingHoursSchema,
  capacity: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const updatePickupLocationSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['STORE', 'WAREHOUSE', 'PARTNER', 'LOCKER']).optional(),
  address: addressSchema.partial().optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  operatingHours: operatingHoursSchema.optional(),
  capacity: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const pickupFiltersSchema = z.object({
  type: z.enum(['STORE', 'WAREHOUSE', 'PARTNER', 'LOCKER']).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().length(2).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

const schedulePickupSchema = z.object({
  orderId: z.string().min(1),
  pickupLocationId: z.string().min(1),
  scheduledDate: z.string().datetime(),
  notes: z.string().optional()
});

export async function pickupRoutes(fastify: FastifyInstance) {
  const pickupService = new PickupService(fastify);

  // Public Routes - Get pickup locations

  /**
   * Get all active pickup locations
   * @route GET /api/pickup/locations
   * @access Public
   * @description Get all active pickup locations with filters
   */
  fastify.get('/pickup/locations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = pickupFiltersSchema.parse((request.query as any));
      const { page, limit, ...filterData } = filters;

      // Public endpoint only shows active locations
      const result = await pickupService.getPickupLocations(
        { ...filterData, isActive: true },
        { page, limit }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch pickup locations'
        });
      }

      return reply.send({
        message: 'Pickup locations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching pickup locations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get pickup location by ID
   * @route GET /api/pickup/locations/:locationId
   * @access Public
   * @description Get detailed information about a pickup location
   */
  fastify.get('/pickup/locations/:locationId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId } = (request.params as any);

      const result = await pickupService.getPickupLocation(locationId);

      if (!result.success) {
        return reply.code(404).send({
          error: result.error?.message || 'Pickup location not found'
        });
      }

      // Only show active locations to public
      if (!result.data || !result.data.isActive) {
        return reply.code(404).send({
          error: 'Pickup location not found'
        });
      }

      return reply.send({
        message: 'Pickup location fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching pickup location:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get nearby pickup locations
   * @route GET /api/pickup/locations/nearby
   * @access Public
   * @description Get pickup locations near a specific coordinate
   */
  fastify.get('/pickup/locations/nearby', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { latitude, longitude, radius = 10, type } = (request.query as any);

      if (!latitude || !longitude) {
        return reply.code(400).send({
          error: 'Latitude and longitude are required'
        });
      }

      const result = await pickupService.getNearbyLocations(
        Number(latitude),
        Number(longitude),
        Number(radius),
        { type: type as any, isActive: true }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch nearby locations'
        });
      }

      return reply.send({
        message: 'Nearby pickup locations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching nearby locations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Customer Routes - Pickup scheduling

  /**
   * Schedule order pickup
   * @route POST /api/pickup/schedule
   * @access Customer
   * @description Schedule a pickup for an order
   */
  fastify.post('/pickup/schedule', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const pickupData = schedulePickupSchema.parse((request.body as any));

      // Verify order belongs to user
      const order = await fastify.prisma.order.findFirst({
        where: {
          id: pickupData.orderId,
          userId: user.id
        }
      });

      if (!order) {
        return reply.code(404).send({
          error: 'Order not found or access denied'
        });
      }

      const result = await pickupService.schedulePickup({
        ...pickupData,
        scheduledDate: new Date(pickupData.scheduledDate)
      });

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to schedule pickup'
        });
      }

      return reply.send({
        message: 'Pickup scheduled successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error scheduling pickup:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get pickup calendar for a location
   * @route GET /api/pickup/locations/:locationId/calendar
   * @access Public
   * @description Get availability calendar for a pickup location
   */
  fastify.get('/pickup/locations/:locationId/calendar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId } = (request.params as any);
      const { startDate, endDate } = (request.query as any);

      if (!startDate || !endDate) {
        return reply.code(400).send({
          error: 'Start date and end date are required'
        });
      }

      const result = await pickupService.getPickupCalendar(
        locationId,
        new Date(startDate),
        new Date(endDate)
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch pickup calendar'
        });
      }

      return reply.send({
        message: 'Pickup calendar fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching pickup calendar:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Admin Routes - Pickup location management

  /**
   * Get all pickup locations (including inactive)
   * @route GET /api/admin/pickup/locations
   * @access Admin, Super Admin
   * @description Get all pickup locations with admin filters
   */
  fastify.get('/admin/pickup/locations', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = pickupFiltersSchema.parse((request.query as any));
      const { page, limit, ...filterData } = filters;

      const result = await pickupService.getPickupLocations(filterData, { page, limit });

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch pickup locations'
        });
      }

      return reply.send({
        message: 'Pickup locations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching pickup locations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Create pickup location
   * @route POST /api/admin/pickup/locations
   * @access Admin, Super Admin
   * @description Create a new pickup location
   */
  fastify.post('/admin/pickup/locations', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const locationData = createPickupLocationSchema.parse((request.body as any));

      const result = await pickupService.createPickupLocation(locationData as any);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to create pickup location'
        });
      }

      return reply.code(201).send({
        message: 'Pickup location created successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error creating pickup location:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Update pickup location
   * @route PUT /api/admin/pickup/locations/:locationId
   * @access Admin, Super Admin
   * @description Update pickup location details
   */
  fastify.put('/admin/pickup/locations/:locationId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId } = (request.params as any);
      const updateData = updatePickupLocationSchema.parse((request.body as any));

      const result = await pickupService.updatePickupLocation(locationId, updateData as any);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to update pickup location'
        });
      }

      return reply.send({
        message: 'Pickup location updated successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error updating pickup location:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Delete pickup location
   * @route DELETE /api/admin/pickup/locations/:locationId
   * @access Super Admin
   * @description Delete a pickup location
   */
  fastify.delete('/admin/pickup/locations/:locationId', {
    preHandler: [authenticate, requireRole('SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId } = (request.params as any);

      const result = await pickupService.deletePickupLocation(locationId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to delete pickup location'
        });
      }

      return reply.send({
        message: 'Pickup location deleted successfully'
      });
    } catch (error) {
      fastify.log.error('Error deleting pickup location:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Toggle pickup location status
   * @route PATCH /api/admin/pickup/locations/:locationId/toggle
   * @access Admin, Super Admin
   * @description Enable or disable a pickup location
   */
  fastify.patch('/admin/pickup/locations/:locationId/toggle', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId } = (request.params as any);

      const result = await pickupService.toggleLocationStatus(locationId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to toggle location status'
        });
      }

      return reply.send({
        message: 'Location status toggled successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error toggling location status:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get pickup location statistics
   * @route GET /api/admin/pickup/locations/:locationId/stats
   * @access Admin, Super Admin
   * @description Get statistics for a pickup location
   */
  fastify.get('/admin/pickup/locations/:locationId/stats', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { locationId } = (request.params as any);

      const result = await pickupService.getLocationStats(locationId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch location statistics'
        });
      }

      return reply.send({
        message: 'Location statistics fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching location statistics:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Complete order pickup
   * @route POST /api/admin/pickup/complete/:orderId
   * @access Admin, Super Admin
   * @description Mark an order as picked up
   */
  fastify.post('/admin/pickup/complete/:orderId', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = (request.params as any);
      const { signature } = (request.body as any);

      const result = await pickupService.completePickup(orderId, signature);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to complete pickup'
        });
      }

      return reply.send({
        message: 'Pickup completed successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error completing pickup:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  /**
   * Generate pickup report
   * @route GET /api/admin/pickup/report
   * @access Admin, Super Admin
   * @description Generate pickup report in JSON or CSV format
   */
  fastify.get('/admin/pickup/report', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { format = 'json', ...filters } = (request.query as any);
      
      const parsedFilters = {
        ...filters,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined
      };

      const result = await pickupService.generatePickupReport(parsedFilters, format);

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
        message: 'Pickup report generated successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error generating pickup report:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}

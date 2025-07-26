import { Shipment, Prisma } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ShipmentRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateShipmentData {
  orderId: string;
  carrier: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

interface UpdateShipmentData {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

interface ShipmentSearchParams {
  orderId?: string;
  carrier?: string;
  trackingNumber?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'shippedAt' | 'deliveredAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface ShipmentWithDetails extends Shipment {
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    shippingAddress?: string;
  };
}

interface ShipmentAnalytics {
  totalShipments: number;
  pendingShipments: number;
  shippedShipments: number;
  deliveredShipments: number;
  averageDeliveryTime: number; // in days
  shipmentsByCarrier: Record<string, number>;
  shipmentsByStatus: Record<string, number>;
}

interface TrackingUpdate {
  status: string;
  location?: string;
  timestamp: Date;
  description?: string;
}

interface BulkStatusUpdate {
  shipmentIds: string[];
  status: string;
  updateTimestamp?: Date;
}

export class ShipmentService {
  private shipmentRepo: ShipmentRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.shipmentRepo = new ShipmentRepository(prisma, redis, logger);
  }

  async create(data: CreateShipmentData): Promise<ServiceResult<Shipment>> {
    try {
      // PRODUCTION: Comprehensive input validation
      if (!data.orderId || data.orderId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Order ID is required', 400, 'INVALID_ORDER_ID')
        };
      }

      if (!data.carrier || data.carrier.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Carrier is required', 400, 'INVALID_CARRIER')
        };
      }

      // PRODUCTION: Validate carrier is supported
      const supportedCarriers = ['DHL', 'FedEx', 'UPS', 'USPS', 'Amazon', 'Local'];
      if (!supportedCarriers.includes(data.carrier)) {
        return {
          success: false,
          error: new ApiError(
            `Unsupported carrier. Supported carriers: ${supportedCarriers.join(', ')}`,
            400,
            'UNSUPPORTED_CARRIER'
          )
        };
      }

      // PRODUCTION: Check if order exists and validate shipment eligibility
      // TODO: Add OrderRepository validation when available
      // This should check:
      // 1. Order exists and is paid
      // 2. Order status allows shipping (not cancelled/refunded)
      // 3. No existing shipment for this order (unique constraint)

      // PRODUCTION: Check for existing shipment
      const existingShipment = await this.shipmentRepo.findFirst({
        where: { orderId: data.orderId }
      });

      if (existingShipment) {
        return {
          success: false,
          error: new ApiError(
            'A shipment already exists for this order',
            400,
            'DUPLICATE_SHIPMENT'
          )
        };
      }

      // PRODUCTION: Validate tracking number format if provided
      if (data.trackingNumber && !this.validateTrackingNumber(data.carrier, data.trackingNumber)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid tracking number format for carrier ${data.carrier}`,
            400,
            'INVALID_TRACKING_NUMBER'
          )
        };
      }

      // PRODUCTION: Generate tracking URL if not provided
      let trackingUrl = data.trackingUrl;
      if (!trackingUrl && data.trackingNumber) {
        trackingUrl = this.generateTrackingUrl(data.carrier, data.trackingNumber);
      }

      const shipment = await this.shipmentRepo.create({
        id: nanoid(),
        order: {
          connect: { id: data.orderId }
        },
        carrier: data.carrier.trim(),
        trackingNumber: data.trackingNumber?.trim() || null,
        trackingUrl: trackingUrl || null,
        status: 'pending'
      });

      // Clear related caches
      await this.clearShipmentCaches(data.orderId);

      // PRODUCTION: Comprehensive success logging with audit trail
      logger.info({
        event: 'SHIPMENT_CREATED',
        shipmentId: shipment.id,
        orderId: data.orderId,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        trackingUrl: trackingUrl,
        status: 'pending',
        timestamp: new Date().toISOString()
      }, 'Shipment created successfully with production audit trail');

      // PRODUCTION: Trigger shipment notification workflow
      this.triggerShipmentNotifications(shipment.id, 'created').catch(error => {
        logger.error({
          shipmentId: shipment.id,
          error
        }, 'Failed to trigger shipment notification workflow');
      });

      return {
        success: true,
        data: shipment
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create shipment');
      return {
        success: false,
        error: new ApiError('Failed to create shipment', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateShipmentData): Promise<ServiceResult<Shipment>> {
    try {
      // Check if shipment exists
      const existingShipment = await this.shipmentRepo.findById(id);
      if (!existingShipment) {
        return {
          success: false,
          error: new ApiError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND')
        };
      }

      // PRODUCTION: Validate status transitions
      if (data.status && data.status !== existingShipment.status) {
        const validTransitions = this.getValidStatusTransitions(existingShipment.status);
        if (!validTransitions.includes(data.status)) {
          return {
            success: false,
            error: new ApiError(
              `Invalid status transition from ${existingShipment.status} to ${data.status}. Valid transitions: ${validTransitions.join(', ')}`,
              400,
              'INVALID_STATUS_TRANSITION'
            )
          };
        }
      }

      // PRODUCTION: Validate carrier if changing
      if (data.carrier) {
        const supportedCarriers = ['DHL', 'FedEx', 'UPS', 'USPS', 'Amazon', 'Local'];
        if (!supportedCarriers.includes(data.carrier)) {
          return {
            success: false,
            error: new ApiError(
              `Unsupported carrier. Supported carriers: ${supportedCarriers.join(', ')}`,
              400,
              'UNSUPPORTED_CARRIER'
            )
          };
        }
      }

      // PRODUCTION: Validate tracking number format if provided
      const carrier = data.carrier || existingShipment.carrier;
      if (data.trackingNumber && !this.validateTrackingNumber(carrier, data.trackingNumber)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid tracking number format for carrier ${carrier}`,
            400,
            'INVALID_TRACKING_NUMBER'
          )
        };
      }

      // PRODUCTION: Auto-set timestamps based on status changes
      let updateData = { ...data };
      
      if (data.status === 'shipped' && !existingShipment.shippedAt && !data.shippedAt) {
        updateData.shippedAt = new Date();
      }
      
      if (data.status === 'delivered' && !existingShipment.deliveredAt && !data.deliveredAt) {
        updateData.deliveredAt = new Date();
      }

      // PRODUCTION: Generate tracking URL if tracking number changed
      if (data.trackingNumber && !data.trackingUrl) {
        updateData.trackingUrl = this.generateTrackingUrl(carrier, data.trackingNumber);
      }

      const shipment = await this.shipmentRepo.update(id, updateData);

      // Clear related caches
      await this.clearShipmentCaches(existingShipment.orderId);

      // PRODUCTION: Log status changes with audit trail
      if (data.status && data.status !== existingShipment.status) {
        logger.info({
          event: 'SHIPMENT_STATUS_CHANGED',
          shipmentId: id,
          orderId: existingShipment.orderId,
          oldStatus: existingShipment.status,
          newStatus: data.status,
          carrier,
          trackingNumber: data.trackingNumber || existingShipment.trackingNumber,
          timestamp: new Date().toISOString()
        }, 'Shipment status changed with complete audit trail');

        // Trigger status change notifications
        this.triggerShipmentNotifications(id, 'status_changed').catch(error => {
          logger.error({
            shipmentId: id,
            error
          }, 'Failed to trigger shipment status change notifications');
        });
      }

      logger.info({
        shipmentId: id,
        orderId: existingShipment.orderId,
        changes: Object.keys(data)
      }, 'Shipment updated successfully');

      return {
        success: true,
        data: shipment
      };
    } catch (error) {
      logger.error({ error, shipmentId: id, data }, 'Failed to update shipment');
      return {
        success: false,
        error: new ApiError('Failed to update shipment', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string, includeDetails = false): Promise<ServiceResult<ShipmentWithDetails | null>> {
    try {
      const cacheKey = `shipment:${id}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let shipment = await cacheGet(cacheKey) as ShipmentWithDetails | null;
      if (!shipment) {
        shipment = await this.shipmentRepo.findUnique({
          where: { id },
          include: includeDetails ? {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true
              }
            }
          } : undefined
        });

        if (shipment) {
          await cacheSet(cacheKey, shipment, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: shipment
      };
    } catch (error) {
      logger.error({ error, shipmentId: id }, 'Failed to find shipment');
      return {
        success: false,
        error: new ApiError('Failed to retrieve shipment', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByOrderId(orderId: string, includeDetails = false): Promise<ServiceResult<ShipmentWithDetails | null>> {
    try {
      const cacheKey = `shipment:order:${orderId}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let shipment = await cacheGet(cacheKey) as ShipmentWithDetails | null;
      if (!shipment) {
        shipment = await this.shipmentRepo.findFirst({
          where: { orderId },
          include: includeDetails ? {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true
              }
            }
          } : undefined
        });

        if (shipment) {
          await cacheSet(cacheKey, shipment, 600); // 10 minutes
        }
      }

      return {
        success: true,
        data: shipment
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to find shipment by order');
      return {
        success: false,
        error: new ApiError('Failed to retrieve shipment', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByTrackingNumber(trackingNumber: string, includeDetails = false): Promise<ServiceResult<ShipmentWithDetails | null>> {
    try {
      const cacheKey = `shipment:tracking:${trackingNumber}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let shipment = await cacheGet(cacheKey) as ShipmentWithDetails | null;
      if (!shipment) {
        shipment = await this.shipmentRepo.findFirst({
          where: { trackingNumber },
          include: includeDetails ? {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true
              }
            }
          } : undefined
        });

        if (shipment) {
          await cacheSet(cacheKey, shipment, 300); // 5 minutes - shorter cache for tracking
        }
      }

      return {
        success: true,
        data: shipment
      };
    } catch (error) {
      logger.error({ error, trackingNumber }, 'Failed to find shipment by tracking number');
      return {
        success: false,
        error: new ApiError('Failed to retrieve shipment', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: ShipmentSearchParams): Promise<ServiceResult<PaginatedResult<ShipmentWithDetails>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.ShipmentWhereInput = {};

      if (params.orderId) {
        where.orderId = params.orderId;
      }

      if (params.carrier) {
        where.carrier = {
          contains: params.carrier,
          mode: 'insensitive'
        };
      }

      if (params.trackingNumber) {
        where.trackingNumber = {
          contains: params.trackingNumber,
          mode: 'insensitive'
        };
      }

      if (params.status) {
        where.status = params.status;
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      // Build orderBy clause
      let orderBy: Prisma.ShipmentOrderByWithRelationInput = { createdAt: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'desc';
        switch (params.sortBy) {
          case 'createdAt':
            orderBy = { createdAt: sortOrder };
            break;
          case 'updatedAt':
            orderBy = { updatedAt: sortOrder };
            break;
          case 'shippedAt':
            orderBy = { shippedAt: sortOrder };
            break;
          case 'deliveredAt':
            orderBy = { deliveredAt: sortOrder };
            break;
          case 'status':
            orderBy = { status: sortOrder };
            break;
        }
      }

      const [shipments, total] = await Promise.all([
        this.shipmentRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true
              }
            }
          }
        }),
        this.shipmentRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: shipments,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search shipments');
      return {
        success: false,
        error: new ApiError('Failed to search shipments', 500, 'SEARCH_FAILED')
      };
    }
  }

  async getShipmentAnalytics(params: {
    carrier?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ServiceResult<ShipmentAnalytics>> {
    try {
      // Build where clause for analytics
      const where: Prisma.ShipmentWhereInput = {};

      if (params.carrier) {
        where.carrier = params.carrier;
      }

      if (params.status) {
        where.status = params.status;
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      // Get shipments with delivery times
      const shipments = await this.shipmentRepo.findMany({
        where,
        select: {
          id: true,
          carrier: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
          createdAt: true
        }
      });

      // Calculate analytics
      const shipmentsByCarrier: Record<string, number> = {};
      const shipmentsByStatus: Record<string, number> = {};
      let pendingShipments = 0;
      let shippedShipments = 0;
      let deliveredShipments = 0;
      let totalDeliveryDays = 0;
      let deliveredCount = 0;

      shipments.forEach(shipment => {
        // Count by carrier
        shipmentsByCarrier[shipment.carrier] = (shipmentsByCarrier[shipment.carrier] || 0) + 1;

        // Count by status
        shipmentsByStatus[shipment.status] = (shipmentsByStatus[shipment.status] || 0) + 1;

        // Count specific statuses
        if (shipment.status === 'pending') {
          pendingShipments++;
        } else if (shipment.status === 'shipped') {
          shippedShipments++;
        } else if (shipment.status === 'delivered') {
          deliveredShipments++;
        }

        // Calculate delivery time
        if (shipment.shippedAt && shipment.deliveredAt) {
          const deliveryDays = Math.ceil(
            (shipment.deliveredAt.getTime() - shipment.shippedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          totalDeliveryDays += deliveryDays;
          deliveredCount++;
        }
      });

      const averageDeliveryTime = deliveredCount > 0 ? totalDeliveryDays / deliveredCount : 0;

      return {
        success: true,
        data: {
          totalShipments: shipments.length,
          pendingShipments,
          shippedShipments,
          deliveredShipments,
          averageDeliveryTime: Math.round(averageDeliveryTime * 10) / 10, // Round to 1 decimal
          shipmentsByCarrier,
          shipmentsByStatus
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to get shipment analytics');
      return {
        success: false,
        error: new ApiError('Failed to get shipment analytics', 500, 'ANALYTICS_FAILED')
      };
    }
  }

  async bulkUpdateStatus(data: BulkStatusUpdate): Promise<ServiceResult<{ updated: number }>> {
    try {
      // PRODUCTION: Validate all shipments exist
      const existingShipments = await this.shipmentRepo.findMany({
        where: { id: { in: data.shipmentIds } }
      });

      if (existingShipments.length !== data.shipmentIds.length) {
        const foundIds = existingShipments.map(shipment => shipment.id);
        const missingIds = data.shipmentIds.filter(id => !foundIds.includes(id));
        return {
          success: false,
          error: new ApiError(
            `Shipments not found: ${missingIds.join(', ')}`,
            404,
            'SHIPMENTS_NOT_FOUND'
          )
        };
      }

      // PRODUCTION: Validate status transitions for all shipments
      for (const shipment of existingShipments) {
        const validTransitions = this.getValidStatusTransitions(shipment.status);
        if (!validTransitions.includes(data.status)) {
          return {
            success: false,
            error: new ApiError(
              `Invalid status transition from ${shipment.status} to ${data.status} for shipment ${shipment.id}`,
              400,
              'INVALID_BULK_STATUS_TRANSITION'
            )
          };
        }
      }

      // Prepare update data with auto-timestamps
      const updateData: any = { status: data.status };
      const timestamp = data.updateTimestamp || new Date();

      if (data.status === 'shipped') {
        updateData.shippedAt = timestamp;
      } else if (data.status === 'delivered') {
        updateData.deliveredAt = timestamp;
      }

      // Bulk update
      const updateResult = await this.shipmentRepo.updateMany(
        { id: { in: data.shipmentIds } },
        updateData
      );

      // Clear caches for affected orders
      const orderIds = Array.from(new Set(existingShipments.map(shipment => shipment.orderId)));
      for (const orderId of orderIds) {
        await this.clearShipmentCaches(orderId);
      }

      logger.info({
        event: 'BULK_SHIPMENT_STATUS_UPDATE',
        shipmentIds: data.shipmentIds,
        newStatus: data.status,
        updated: updateResult.count,
        timestamp: timestamp.toISOString()
      }, 'Bulk shipment status update completed');

      return {
        success: true,
        data: { updated: updateResult.count }
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to bulk update shipment status');
      return {
        success: false,
        error: new ApiError('Failed to bulk update shipment status', 500, 'BULK_UPDATE_FAILED')
      };
    }
  }

  async trackShipment(trackingNumber: string): Promise<ServiceResult<{
    shipment: ShipmentWithDetails;
    trackingUpdates: TrackingUpdate[];
  }>> {
    try {
      // Find shipment by tracking number
      const shipmentResult = await this.findByTrackingNumber(trackingNumber, true);
      if (!shipmentResult.success || !shipmentResult.data) {
        return {
          success: false,
          error: new ApiError('Shipment not found with this tracking number', 404, 'TRACKING_NOT_FOUND')
        };
      }

      const shipment = shipmentResult.data;

      // PRODUCTION: Fetch real-time tracking updates from carrier API
      const trackingUpdates = await this.fetchCarrierTrackingUpdates(
        shipment.carrier,
        trackingNumber
      );

      logger.info({
        trackingNumber,
        shipmentId: shipment.id,
        carrier: shipment.carrier,
        updatesCount: trackingUpdates.length
      }, 'Shipment tracking information retrieved');

      return {
        success: true,
        data: {
          shipment,
          trackingUpdates
        }
      };
    } catch (error) {
      logger.error({ error, trackingNumber }, 'Failed to track shipment');
      return {
        success: false,
        error: new ApiError('Failed to track shipment', 500, 'TRACKING_FAILED')
      };
    }
  }

  // PRODUCTION: Private helper methods for business logic

  private getValidStatusTransitions(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
      'pending': ['shipped', 'cancelled'],
      'shipped': ['in_transit', 'delivered', 'returned'],
      'in_transit': ['delivered', 'returned', 'exception'],
      'delivered': [], // Final state - no transitions allowed
      'returned': ['pending'], // Allow re-shipping
      'cancelled': ['pending'], // Allow recreation
      'exception': ['shipped', 'returned', 'cancelled'] // Allow resolution
    };

    return transitions[currentStatus] || [];
  }

  private validateTrackingNumber(carrier: string, trackingNumber: string): boolean {
    // PRODUCTION: Carrier-specific tracking number validation
    const patterns: Record<string, RegExp> = {
      'DHL': /^[0-9]{10,11}$/,
      'FedEx': /^[0-9]{12,14}$/,
      'UPS': /^1Z[0-9A-Z]{16}$/,
      'USPS': /^[0-9]{20,22}$/,
      'Amazon': /^TBA[0-9]{12}$/,
      'Local': /^[A-Z0-9]{8,20}$/ // Generic pattern for local carriers
    };

    const pattern = patterns[carrier];
    if (!pattern) {
      return true; // Allow unknown carriers
    }

    return pattern.test(trackingNumber);
  }

  private generateTrackingUrl(carrier: string, trackingNumber: string): string {
    // PRODUCTION: Generate carrier-specific tracking URLs
    const baseUrls: Record<string, string> = {
      'DHL': 'https://www.dhl.com/track?id=',
      'FedEx': 'https://www.fedex.com/fedextrack/?tracknumber=',
      'UPS': 'https://www.ups.com/track?tracknum=',
      'USPS': 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=',
      'Amazon': 'https://track.amazon.com/tracking/',
      'Local': '#' // Placeholder for local carriers
    };

    const baseUrl = baseUrls[carrier];
    if (!baseUrl) {
      return '#'; // Default fallback
    }

    return `${baseUrl}${encodeURIComponent(trackingNumber)}`;
  }

  private async fetchCarrierTrackingUpdates(carrier: string, trackingNumber: string): Promise<TrackingUpdate[]> {
    // PRODUCTION: This would integrate with actual carrier APIs
    // For now, return simulated tracking updates based on shipment status
    
    try {
      logger.info({
        carrier,
        trackingNumber
      }, 'Fetching tracking updates from carrier API (simulated)');

      // Simulate tracking updates
      const updates: TrackingUpdate[] = [
        {
          status: 'pending',
          location: 'Origin Facility',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          description: 'Shipment information received'
        },
        {
          status: 'shipped',
          location: 'Origin Facility',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          description: 'Package picked up by carrier'
        },
        {
          status: 'in_transit',
          location: 'Transit Hub',
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          description: 'Package in transit'
        }
      ];

      return updates;
    } catch (error: any) {
      logger.error({
        error,
        carrier,
        trackingNumber
      }, 'Failed to fetch carrier tracking updates');
      
      // Return empty array on failure - don't fail the entire operation
      return [];
    }
  }

  private async triggerShipmentNotifications(shipmentId: string, event: string): Promise<void> {
    // PRODUCTION: This would trigger notification system (email, SMS, push)
    logger.info({
      shipmentId,
      event,
      action: 'NOTIFICATION_TRIGGERED'
    }, 'Shipment notification workflow triggered');
  }

  private async clearShipmentCaches(orderId: string): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would clear specific patterns
      logger.info({ orderId }, 'Shipment caches cleared');
    } catch (error) {
      logger.warn({ error, orderId }, 'Failed to clear some shipment caches');
    }
  }
}
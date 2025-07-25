import { FastifyInstance } from 'fastify';
import { Prisma, PickupLocation, Order } from '@prisma/client';
import { ServiceResult } from '../types';
import { ApiError } from '../utils/errors';

export interface CreatePickupLocationData {
  sellerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  maxCapacityPerSlot?: number;
}

export interface UpdatePickupLocationData {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  maxCapacityPerSlot?: number;
}

export interface PickupLocationFilters {
  sellerId?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
  search?: string;
}

export interface PickupOrderData {
  orderId: string;
  pickupLocationId: string;
  scheduledDate: Date;
  notes?: string;
}

export class PickupService {
  private prisma: FastifyInstance['prisma'];
  private logger: FastifyInstance['log'];

  constructor(private app: FastifyInstance) {
    this.prisma = app.prisma;
    this.logger = app.log;
  }

  async createPickupLocation(data: CreatePickupLocationData): Promise<ServiceResult<PickupLocation>> {
    try {
      // Check for duplicate location at same address
      const existingLocation = await this.prisma.pickupLocation.findFirst({
        where: {
          sellerId: data.sellerId,
          address: data.address,
          city: data.city,
          country: data.country
        }
      });

      if (existingLocation) {
        return {
          success: false,
          error: new ApiError('A pickup location already exists at this address', 400, 'LOCATION_EXISTS')
        };
      }

      const location = await this.prisma.pickupLocation.create({
        data: {
          ...data,
          isActive: data.isActive ?? true,
          maxCapacityPerSlot: data.maxCapacityPerSlot ?? 10
        }
      });

      return {
        success: true,
        data: location
      };
    } catch (error) {
      this.logger.error('Error creating pickup location:', error);
      return {
        success: false,
        error: new ApiError('Failed to create pickup location', 500, 'CREATION_ERROR')
      };
    }
  }

  async getPickupLocations(
    filters: PickupLocationFilters = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const where: Prisma.PickupLocationWhereInput = {};
      
      if (filters.sellerId) where.sellerId = filters.sellerId;
      if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
      if (filters.state) where.state = { contains: filters.state, mode: 'insensitive' };
      if (filters.country) where.country = { contains: filters.country, mode: 'insensitive' };
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { address: { contains: filters.search, mode: 'insensitive' } },
          { city: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      const [locations, total] = await this.prisma.$transaction([
        this.prisma.pickupLocation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' }
        }),
        this.prisma.pickupLocation.count({ where })
      ]);

      return {
        success: true,
        data: {
          locations,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Error fetching pickup locations:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch pickup locations', 500, 'FETCH_ERROR')
      };
    }
  }

  async getPickupLocation(id: string): Promise<ServiceResult<PickupLocation>> {
    try {
      const location = await this.prisma.pickupLocation.findUnique({
        where: { id },
        include: {
          seller: {
            select: {
              id: true,
              businessName: true,
              businessEmail: true
            }
          }
        }
      });

      if (!location) {
        return {
          success: false,
          error: new ApiError('Pickup location not found', 404, 'LOCATION_NOT_FOUND')
        };
      }

      return {
        success: true,
        data: location
      };
    } catch (error) {
      this.logger.error('Error fetching pickup location:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch pickup location', 500, 'FETCH_ERROR')
      };
    }
  }

  async updatePickupLocation(
    id: string,
    data: UpdatePickupLocationData
  ): Promise<ServiceResult<PickupLocation>> {
    try {
      const location = await this.prisma.pickupLocation.update({
        where: { id },
        data
      });

      return {
        success: true,
        data: location
      };
    } catch (error) {
      this.logger.error('Error updating pickup location:', error);
      return {
        success: false,
        error: new ApiError('Failed to update pickup location', 500, 'UPDATE_ERROR')
      };
    }
  }

  async deletePickupLocation(id: string): Promise<ServiceResult<void>> {
    try {
      // Check if location has active orders
      const activeOrders = await this.prisma.order.count({
        where: {
          pickupLocationId: id,
          status: { in: ['PENDING', 'PROCESSING', 'SHIPPED'] }
        }
      });
      
      if (activeOrders > 0) {
        return {
          success: false,
          error: new ApiError('Cannot delete location with active orders', 400, 'LOCATION_HAS_ACTIVE_ORDERS')
        };
      }

      await this.prisma.pickupLocation.delete({ where: { id } });

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      this.app.log.error('Error deleting pickup location:', error);
      return {
        success: false,
        error: new ApiError('Failed to delete pickup location', 500, 'DELETE_ERROR')
      };
    }
  }

  async getNearbyLocations(
    latitude: number,
    longitude: number,
    radius: number, // in kilometers
    filters: { type?: string; isActive?: boolean }
  ): Promise<ServiceResult<any>> {
    try {
      const locations = await this.prisma.$queryRaw`
        SELECT *, (
          6371 * acos(
            cos(radians(${latitude})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(latitude))
          )
        ) AS distance
        FROM "PickupLocation"
        WHERE (
          6371 * acos(
            cos(radians(${latitude})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(latitude))
          )
        ) < ${radius}
        AND "isActive" = ${filters.isActive ?? true}
        ${filters.type ? Prisma.sql`AND "type" = ${filters.type}` : Prisma.empty}
        ORDER BY distance;
      `;

      return { success: true, data: locations };
    } catch (error) {
      this.logger.error('Error fetching nearby locations:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch nearby locations', 500, 'FETCH_ERROR')
      };
    }
  }

  async schedulePickup(data: PickupOrderData): Promise<ServiceResult<Order>> {
    try {
      const order = await this.prisma.order.update({
        where: { id: data.orderId },
        data: {
          pickupLocationId: data.pickupLocationId,
          pickupSlot: data.scheduledDate,
          status: 'PROCESSING'
        }
      });
      return { success: true, data: order };
    } catch (error) {
      this.logger.error('Error scheduling pickup:', error);
      return {
        success: false,
        error: new ApiError('Failed to schedule pickup', 500, 'SCHEDULE_ERROR')
      };
    }
  }

  async getPickupCalendar(
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ServiceResult<any>> {
    try {
      const pickups = await this.prisma.order.findMany({
        where: {
          pickupLocationId: locationId,
          pickupSlot: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          pickupSlot: true
        }
      });

      // This is a simplified calendar, just returning slots.
      // A real implementation would be more complex.
      const calendar = pickups.reduce((acc: Record<string, number>, pickup) => {
        if (pickup.pickupSlot) {
          const date = pickup.pickupSlot.toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
        }
        return acc;
      }, {});

      return { success: true, data: calendar };
    } catch (error) {
      this.logger.error('Error fetching pickup calendar:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch pickup calendar', 500, 'FETCH_ERROR')
      };
    }
  }

  async toggleLocationStatus(id: string): Promise<ServiceResult<PickupLocation>> {
    try {
      const location = await this.prisma.pickupLocation.findUnique({ where: { id } });
      if (!location) {
        return { success: false, error: new ApiError('Location not found', 404) };
      }
      const updatedLocation = await this.prisma.pickupLocation.update({
        where: { id },
        data: { isActive: !location.isActive }
      });
      return { success: true, data: updatedLocation };
    } catch (error) {
      this.logger.error('Error toggling location status:', error);
      return {
        success: false,
        error: new ApiError('Failed to toggle location status', 500, 'UPDATE_ERROR')
      };
    }
  }

  async getLocationStats(id: string): Promise<ServiceResult<any>> {
    try {
      const stats = await this.prisma.order.aggregate({
        where: { pickupLocationId: id },
        _count: {
          id: true
        },
        _sum: {
          totalAmount: true
        }
      });
      return {
        success: true,
        data: {
          totalPickups: stats._count.id,
          totalValue: stats._sum.totalAmount
        }
      };
    } catch (error) {
      this.logger.error('Error fetching location stats:', error);
      return {
        success: false,
        error: new ApiError('Failed to fetch location stats', 500, 'FETCH_ERROR')
      };
    }
  }

  async completePickup(orderId: string, signature?: string): Promise<ServiceResult<Order>> {
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          // In a real app, you'd save the signature to a file and store the URL
          fraudFlags: signature ? ['pickup_signature_provided'] : []
        }
      });
      return { success: true, data: order };
    } catch (error) {
      this.logger.error('Error completing pickup:', error);
      return {
        success: false,
        error: new ApiError('Failed to complete pickup', 500, 'UPDATE_ERROR')
      };
    }
  }

  async generatePickupReport(
    filters: any,
    format: 'json' | 'csv'
  ): Promise<ServiceResult<any>> {
    try {
      const where: Prisma.OrderWhereInput = {
        pickupLocationId: { not: null },
        ...filters
      };

      const pickups = await this.prisma.order.findMany({ where });

      if (format === 'csv') {
        const csv = this.jsonToCsv(pickups);
        return {
          success: true,
          data: {
            filename: `pickup-report-${new Date().toISOString()}.csv`,
            content: csv
          }
        };
      }

      return { success: true, data: pickups };
    } catch (error) {
      this.logger.error('Error generating pickup report:', error);
      return {
        success: false,
        error: new ApiError('Failed to generate pickup report', 500, 'REPORT_ERROR')
      };
    }
  }

  private jsonToCsv(items: any[]): string {
    if (items.length === 0) {
      return '';
    }
    const replacer = (_key: any, value: any) => (value === null ? '' : value);
    const header = Object.keys(items[0]);
    const csv = [
      header.join(','),
      ...items.map((row) =>
        header
          .map((fieldName) => JSON.stringify(row[fieldName], replacer))
          .join(',')
      )
    ].join('\r\n');
    return csv;
  }
}
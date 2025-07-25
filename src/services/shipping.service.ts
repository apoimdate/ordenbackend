import { ShippingZone, Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { cache } from '../utils/cache';
import { 
  ShippingZoneRepository,
  ShippingZoneMethodRepository
} from "../repositories";
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';

interface ShippingSearchParams {
  query?: string;
  active?: boolean;
  isActive?: boolean;
  country?: string;
  sortBy?: string;
  type?: string;
  page?: number;
  limit?: number;
}

interface ShippingZoneWithDetails extends ShippingZone {
  methods?: any[];
}

// interface ShippingCalculationData {
//   destination: {
//     country: string;
//     state?: string;
//     zipCode?: string;
//   };
// }

export class ShippingService extends CrudService<ShippingZone, Prisma.ShippingZoneCreateInput, Prisma.ShippingZoneUpdateInput> {
  modelName = 'shippingZone' as const;

  private shippingZoneRepo: ShippingZoneRepository;
  private shippingZoneMethodRepo: ShippingZoneMethodRepository;
  // Removed unused repositories

  constructor(app: FastifyInstance) {
    super(app);
    this.shippingZoneRepo = new ShippingZoneRepository(this.prisma, this.app.redis, this.logger);
    this.shippingZoneMethodRepo = new ShippingZoneMethodRepository(this.prisma, this.app.redis, this.logger);
  }

  // ... (methods up to calculateShipping are correct)

  async searchShippingZones(params: ShippingSearchParams): Promise<ServiceResult<PaginatedResult<ShippingZoneWithDetails>>> {
    try {
      const cacheKey = `shipping:zones:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<ShippingZoneWithDetails>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.ShippingZoneWhereInput = {};

      if (params.query) {
        where.OR = [
          { name: { contains: params.query, mode: 'insensitive' } }
        ];
      }

      if (params.country) {
        where.countries = { has: params.country };
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      let orderBy: Prisma.ShippingZoneOrderByWithRelationInput = { createdAt: 'desc' };
      switch (params.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'name_asc':
          orderBy = { name: 'asc' };
          break;
        case 'name_desc':
          orderBy = { name: 'desc' };
          break;
      }

      const [zones, total] = await Promise.all([
        this.shippingZoneRepo.findMany({
          where,
          include: {
            _count: {
              select: {
                shippingRates: true,
              }
            }
          },
          orderBy,
          skip,
          take: limit
        }),
        this.shippingZoneRepo.count({ where })
      ]);

      const result: PaginatedResult<ShippingZoneWithDetails> = {
        data: zones as unknown as ShippingZoneWithDetails[],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

      await cache.set(cacheKey, result, { ttl: 300 });

      return { success: true, data: result };
    } catch (error: any) {
      this.app.log.error({ err: error }, 'Failed to search shipping zones');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search shipping zones', 500, error.code, error.message)
      };
    }
  }

  async searchShippingMethods(params: ShippingSearchParams): Promise<ServiceResult<PaginatedResult<any>>> {
    try {
      const cacheKey = `shipping:methods:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<any>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.ShippingZoneMethodWhereInput = {};

      if (params.query) {
        where.OR = [
          { name: { contains: params.query, mode: 'insensitive' } }
        ];
      }

      // Type field not available in ShippingZoneMethod model

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      let orderBy: Prisma.ShippingZoneMethodOrderByWithRelationInput = { rate: 'asc' };
      switch (params.sortBy) {
        case 'rate_desc':
          orderBy = { rate: 'desc' };
          break;
        case 'name_asc':
          orderBy = { name: 'asc' };
          break;
        case 'name_desc':
          orderBy = { name: 'desc' };
          break;
      }

      const [methods, total] = await Promise.all([
        this.shippingZoneMethodRepo.findMany({
          where,
          orderBy,
          skip,
          take: limit
        }),
        this.shippingZoneMethodRepo.count({ where })
      ]);

      const result: PaginatedResult<any> = {
        data: methods,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

      await cache.set(cacheKey, result, { ttl: 300 });

      return { success: true, data: result };
    } catch (error: any) {
      this.app.log.error({ err: error }, 'Failed to search shipping methods');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search shipping methods', 500, error.code, error.message)
      };
    }
  }

}

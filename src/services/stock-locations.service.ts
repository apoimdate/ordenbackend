import { FastifyInstance } from 'fastify';
import { stock_locations as StockLocation, Prisma } from '@prisma/client';
import { CrudService, CrudQuery } from './crud.service';
import { PaginatedResult, ServiceResult } from '../types';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

export class StockLocationService extends CrudService<StockLocation, Prisma.stock_locationsCreateInput, Prisma.stock_locationsUpdateInput> {
  modelName = 'stock_locations' as const;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async findMany(query: CrudQuery): Promise<ServiceResult<PaginatedResult<StockLocation>>> {
    try {
      const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { address_line_1: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await this.prisma.$transaction([
        this.prisma.stock_locations.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.stock_locations.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: items,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to find stockLocations');
      return {
        success: false,
        error: new ApiError('Failed to fetch stockLocations', 500, error.code, error.message),
      };
    }
  }

  async create(data: Prisma.stock_locationsCreateInput): Promise<ServiceResult<StockLocation>> {
    try {
      const stockLocation = await this.prisma.stock_locations.create({
        data,
      });
      return { success: true, data: stockLocation };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create stockLocation');
      return {
        success: false,
        error: new ApiError('Failed to create stockLocation', 500, error.code, error.message),
      };
    }
  }

  async findById(id: string): Promise<ServiceResult<StockLocation | null>> {
    try {
      const stockLocation = await this.prisma.stock_locations.findUnique({
        where: { id },
      });
      return { success: true, data: stockLocation };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to find stockLocation');
      return {
        success: false,
        error: new ApiError('Failed to fetch stockLocation', 500, error.code, error.message),
      };
    }
  }

  async update(id: string, data: Prisma.stock_locationsUpdateInput): Promise<ServiceResult<StockLocation>> {
    try {
      const stockLocation = await this.prisma.stock_locations.update({
        where: { id },
        data,
      });
      return { success: true, data: stockLocation };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update stockLocation');
      return {
        success: false,
        error: new ApiError('Failed to update stockLocation', 500, error.code, error.message),
      };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await this.prisma.stock_locations.delete({
        where: { id },
      });
      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to delete stockLocation');
      return {
        success: false,
        error: new ApiError('Failed to delete stockLocation', 500, error.code, error.message),
      };
    }
  }
}

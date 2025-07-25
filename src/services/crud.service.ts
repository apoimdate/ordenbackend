import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';
import { BaseService } from './base.service';
import { PaginatedResult, ServiceResult } from '../types';
import { ApiError } from '../utils/errors';

export interface CrudQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any;
}

export abstract class CrudService<
  T,
  CreateInput = Prisma.Args<PrismaClient[keyof PrismaClient], 'create'>['data'],
  UpdateInput = Prisma.Args<PrismaClient[keyof PrismaClient], 'update'>['data']
> extends BaseService {
  abstract modelName: keyof PrismaClient;

  constructor(app: FastifyInstance) {
    super(app);
  }

  async findMany(query: CrudQuery = {}): Promise<ServiceResult<PaginatedResult<T>>> {
    try {
      const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = query;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (search && this.getSearchableFields().length > 0) {
        where.OR = this.getSearchableFields().map(field => ({
          [field]: { contains: search, mode: 'insensitive' }
        }));
      }

      Object.assign(where, this.buildWhereClause(filters));

      const [items, total] = await this.prisma.$transaction([
        (this.prisma[this.modelName] as any).findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: this.getDefaultIncludes()
        }),
        (this.prisma[this.modelName] as any).count({ where })
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
    } catch (error) {
      this.handleError(error, 'findMany');
      return { success: false, error: new ApiError('Failed to fetch items', 500) };
    }
  }

  async findById(id: string): Promise<ServiceResult<T | null>> {
    try {
      const item = await (this.prisma[this.modelName] as any).findUnique({
        where: { id },
        include: this.getDefaultIncludes()
      });

      return { success: true, data: item };
    } catch (error) {
      this.handleError(error, 'findById');
      return { success: false, error: new ApiError(`Failed to fetch item with id ${id}`, 500) };
    }
  }

  async create(data: CreateInput): Promise<ServiceResult<T>> {
    try {
      const item = await (this.prisma[this.modelName] as any).create({
        data,
        include: this.getDefaultIncludes()
      });

      return { success: true, data: item };
    } catch (error) {
      this.handleError(error, 'create');
      return { success: false, error: new ApiError('Failed to create item', 500) };
    }
  }

  async update(id: string, data: UpdateInput): Promise<ServiceResult<T>> {
    try {
      const item = await (this.prisma[this.modelName] as any).update({
        where: { id },
        data,
        include: this.getDefaultIncludes()
      });

      return { success: true, data: item };
    } catch (error) {
      this.handleError(error, 'update');
      return { success: false, error: new ApiError(`Failed to update item with id ${id}`, 500) };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      await (this.prisma[this.modelName] as any).delete({
        where: { id }
      });
      return { success: true, data: undefined };
    } catch (error) {
      this.handleError(error, 'delete');
      return { success: false, error: new ApiError(`Failed to delete item with id ${id}`, 500) };
    }
  }

  protected getSearchableFields(): string[] {
    return ['name', 'title', 'description'];
  }

  protected getDefaultIncludes(): any {
    return undefined;
  }

  protected buildWhereClause(filters: any): any {
    return filters;
  }

  protected handleError(error: any, context: string) {
    this.app.log.error(error, `Error in ${this.constructor.name} - ${context}`);
  }
}

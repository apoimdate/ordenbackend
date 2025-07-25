import { BlogCategory, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BlogCategoryRepository extends BaseRepository<
  BlogCategory,
  Prisma.BlogCategoryCreateInput,
  Prisma.BlogCategoryUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'blogCategory', 300);
  }

  async findBySlug(slug: string, options?: FindOptionsWithoutWhere): Promise<BlogCategory | null> {
    return this.findUnique({ slug }, options);
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<BlogCategory[]> {
    return this.findMany({
      ...options,
      where: {
        
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<BlogCategory[]> {
    return this.findMany({
      ...options,
      where: {
        
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  }

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<BlogCategory[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.findMany({
      ...options,
      where: {
        
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
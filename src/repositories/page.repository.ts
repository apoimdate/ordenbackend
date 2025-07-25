import { Page, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class PageRepository extends BaseRepository<
  Page,
  Prisma.PageCreateInput,
  Prisma.PageUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'page', 300);
  }

  async findBySlug(slug: string, options?: FindOptionsWithoutWhere): Promise<Page | null> {
    return this.findUnique({ slug }, options);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Page[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Page[]> {
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
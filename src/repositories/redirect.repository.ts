import { Redirect, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class RedirectRepository extends BaseRepository<
  Redirect,
  Prisma.RedirectCreateInput,
  Prisma.RedirectUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'redirect', 300);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<Redirect[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<Redirect[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Redirect[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Redirect[]> {
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
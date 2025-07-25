import { ProductAlert, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ProductAlertRepository extends BaseRepository<
  ProductAlert,
  Prisma.ProductAlertCreateInput,
  Prisma.ProductAlertUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'productAlert', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<ProductAlert[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<ProductAlert[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<ProductAlert[]> {
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
  ): Promise<ProductAlert[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<ProductAlert[]> {
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
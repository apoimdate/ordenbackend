import { DashboardWidget, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class DashboardWidgetRepository extends BaseRepository<
  DashboardWidget,
  Prisma.DashboardWidgetCreateInput,
  Prisma.DashboardWidgetUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'dashboardWidget', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<DashboardWidget[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<DashboardWidget[]> {
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
  ): Promise<DashboardWidget[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<DashboardWidget[]> {
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
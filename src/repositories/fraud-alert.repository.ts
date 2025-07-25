import { FraudAlert, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class FraudAlertRepository extends BaseRepository<
  FraudAlert,
  Prisma.FraudAlertCreateInput,
  Prisma.FraudAlertUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'fraudAlert', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<FraudAlert[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<FraudAlert[]> {
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
  ): Promise<FraudAlert[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<FraudAlert[]> {
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
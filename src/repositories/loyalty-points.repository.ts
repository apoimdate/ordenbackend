import { LoyaltyPoints, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class LoyaltyPointsRepository extends BaseRepository<
  LoyaltyPoints,
  Prisma.LoyaltyPointsCreateInput,
  Prisma.LoyaltyPointsUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'loyaltyPoints', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<LoyaltyPoints[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<LoyaltyPoints[]> {
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
  ): Promise<LoyaltyPoints[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<LoyaltyPoints[]> {
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
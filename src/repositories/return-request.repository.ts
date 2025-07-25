import { ReturnRequest, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ReturnRequestRepository extends BaseRepository<
  ReturnRequest,
  Prisma.ReturnRequestCreateInput,
  Prisma.ReturnRequestUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'returnRequest', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<ReturnRequest[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<ReturnRequest[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<ReturnRequest[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<ReturnRequest[]> {
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
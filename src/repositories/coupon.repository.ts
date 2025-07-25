import { Coupon, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CouponRepository extends BaseRepository<
  Coupon,
  Prisma.CouponCreateInput,
  Prisma.CouponUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'coupon', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Coupon[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByCode(code: string, options?: FindOptionsWithoutWhere): Promise<Coupon | null> {
    return this.findUnique({ code }, options);
  }

  async generateUniqueCode(prefix: string = ''): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<Coupon[]> {
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
  ): Promise<Coupon[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Coupon[]> {
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
import { SellerAnalytics, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SellerAnalyticsRepository extends BaseRepository<
  SellerAnalytics,
  Prisma.SellerAnalyticsCreateInput,
  Prisma.SellerAnalyticsUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'sellerAnalytics', 300);
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<SellerAnalytics[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }
}
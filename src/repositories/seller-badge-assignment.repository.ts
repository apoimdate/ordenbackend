import { SellerBadgeAssignment, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SellerBadgeAssignmentRepository extends BaseRepository<
  SellerBadgeAssignment,
  Prisma.SellerBadgeAssignmentCreateInput,
  Prisma.SellerBadgeAssignmentUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'sellerBadgeAssignment', 300);
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<SellerBadgeAssignment[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }
}
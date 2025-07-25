import { CouponUse, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CouponUseRepository extends BaseRepository<
  CouponUse,
  Prisma.CouponUseCreateInput,
  Prisma.CouponUseUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'couponUse', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<CouponUse[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
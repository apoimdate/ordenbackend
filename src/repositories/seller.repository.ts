import { Seller, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SellerRepository extends BaseRepository<
  Seller,
  Prisma.SellerCreateInput,
  Prisma.SellerUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'seller', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Seller[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<Seller[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
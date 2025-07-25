import { ProductView, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ProductViewRepository extends BaseRepository<
  ProductView,
  Prisma.ProductViewCreateInput,
  Prisma.ProductViewUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'productView', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<ProductView[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
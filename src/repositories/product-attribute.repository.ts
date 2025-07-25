import { ProductAttribute, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ProductAttributeRepository extends BaseRepository<
  ProductAttribute,
  Prisma.ProductAttributeCreateInput,
  Prisma.ProductAttributeUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'productAttribute', 300);
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<ProductAttribute[]> {
    return this.findMany({
      ...options,
      where: {
        
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    });
  }
}
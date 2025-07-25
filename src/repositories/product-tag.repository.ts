import { ProductTag, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ProductTagRepository extends BaseRepository<
  ProductTag,
  Prisma.ProductTagCreateInput,
  Prisma.ProductTagUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'productTag', 300);
  }

}
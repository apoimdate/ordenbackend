import { CollectionProduct, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CollectionProductRepository extends BaseRepository<
  CollectionProduct,
  Prisma.CollectionProductCreateInput,
  Prisma.CollectionProductUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'collectionProduct', 300);
  }

}
import { BundleItem, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BundleItemRepository extends BaseRepository<
  BundleItem,
  Prisma.BundleItemCreateInput,
  Prisma.BundleItemUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'bundleItem', 300);
  }

}
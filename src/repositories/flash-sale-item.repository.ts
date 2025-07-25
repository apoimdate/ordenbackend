import { FlashSaleItem, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class FlashSaleItemRepository extends BaseRepository<
  FlashSaleItem,
  Prisma.FlashSaleItemCreateInput,
  Prisma.FlashSaleItemUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'flashSaleItem', 300);
  }

}
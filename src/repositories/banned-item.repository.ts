import { BannedItem, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BannedItemRepository extends BaseRepository<
  BannedItem,
  Prisma.BannedItemCreateInput,
  Prisma.BannedItemUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'bannedItem', 300);
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<BannedItem[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }
}
import { InventoryLog, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class InventoryLogRepository extends BaseRepository<
  InventoryLog,
  Prisma.InventoryLogCreateInput,
  Prisma.InventoryLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'inventoryLog', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<InventoryLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<InventoryLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }
}
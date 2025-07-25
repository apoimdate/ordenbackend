import { MenuItem, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class MenuItemRepository extends BaseRepository<
  MenuItem,
  Prisma.MenuItemCreateInput,
  Prisma.MenuItemUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'menuItem', 300);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<MenuItem[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }
}
import { StoreSetting, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class StoreSettingRepository extends BaseRepository<
  StoreSetting,
  Prisma.StoreSettingCreateInput,
  Prisma.StoreSettingUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'storeSetting', 300);
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<StoreSetting[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }
}
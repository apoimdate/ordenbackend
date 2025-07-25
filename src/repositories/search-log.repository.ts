import { SearchLog, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SearchLogRepository extends BaseRepository<
  SearchLog,
  Prisma.SearchLogCreateInput,
  Prisma.SearchLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'searchLog', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<SearchLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
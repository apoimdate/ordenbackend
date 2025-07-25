import { ApiRequestLog, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ApiRequestLogRepository extends BaseRepository<
  ApiRequestLog,
  Prisma.ApiRequestLogCreateInput,
  Prisma.ApiRequestLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'apiRequestLog', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<ApiRequestLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
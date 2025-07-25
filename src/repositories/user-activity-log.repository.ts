import { UserActivityLog, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class UserActivityLogRepository extends BaseRepository<
  UserActivityLog,
  Prisma.UserActivityLogCreateInput,
  Prisma.UserActivityLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'userActivityLog', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<UserActivityLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
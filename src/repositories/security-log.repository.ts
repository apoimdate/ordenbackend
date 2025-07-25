import { SecurityLog, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SecurityLogRepository extends BaseRepository<
  SecurityLog,
  Prisma.SecurityLogCreateInput,
  Prisma.SecurityLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'securityLog', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<SecurityLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<SecurityLog[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }
}
import { SystemHealth, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SystemHealthRepository extends BaseRepository<
  SystemHealth,
  Prisma.SystemHealthCreateInput,
  Prisma.SystemHealthUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'systemHealth', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<SystemHealth[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }
}
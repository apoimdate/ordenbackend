import { Backup, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BackupRepository extends BaseRepository<
  Backup,
  Prisma.BackupCreateInput,
  Prisma.BackupUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'backup', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Backup[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<Backup[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }
}
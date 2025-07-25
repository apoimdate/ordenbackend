import { DataExport, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class DataExportRepository extends BaseRepository<
  DataExport,
  Prisma.DataExportCreateInput,
  Prisma.DataExportUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'dataExport', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<DataExport[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<DataExport[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
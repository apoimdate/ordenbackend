import { AppInstallation, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class AppInstallationRepository extends BaseRepository<
  AppInstallation,
  Prisma.AppInstallationCreateInput,
  Prisma.AppInstallationUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'appInstallation', 300);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<AppInstallation[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }
}
import { PlatformAnalytics, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class PlatformAnalyticsRepository extends BaseRepository<
  PlatformAnalytics,
  Prisma.PlatformAnalyticsCreateInput,
  Prisma.PlatformAnalyticsUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'platformAnalytics', 300);
  }

}
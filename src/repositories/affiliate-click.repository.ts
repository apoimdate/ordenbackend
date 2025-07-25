import { AffiliateClick, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class AffiliateClickRepository extends BaseRepository<
  AffiliateClick,
  Prisma.AffiliateClickCreateInput,
  Prisma.AffiliateClickUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'affiliateClick', 300);
  }

}
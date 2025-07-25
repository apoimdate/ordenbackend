import { BlockedIp, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BlockedIpRepository extends BaseRepository<
  BlockedIp,
  Prisma.BlockedIpCreateInput,
  Prisma.BlockedIpUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'blockedIp', 300);
  }

}
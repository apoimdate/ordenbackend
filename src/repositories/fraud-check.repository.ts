import { FraudCheck, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class FraudCheckRepository extends BaseRepository<
  FraudCheck,
  Prisma.FraudCheckCreateInput,
  Prisma.FraudCheckUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'fraudCheck', 300);
  }

}
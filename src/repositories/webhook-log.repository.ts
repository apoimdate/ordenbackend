import { WebhookLog, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class WebhookLogRepository extends BaseRepository<
  WebhookLog,
  Prisma.WebhookLogCreateInput,
  Prisma.WebhookLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'webhookLog', 300);
  }

}
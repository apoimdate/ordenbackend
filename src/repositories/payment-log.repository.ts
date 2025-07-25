import { PaymentLog, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class PaymentLogRepository extends BaseRepository<
  PaymentLog,
  Prisma.PaymentLogCreateInput,
  Prisma.PaymentLogUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'paymentLog', 300);
  }

}
import { AbandonedCheckout, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class AbandonedCheckoutRepository extends BaseRepository<
  AbandonedCheckout,
  Prisma.AbandonedCheckoutCreateInput,
  Prisma.AbandonedCheckoutUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'abandonedCheckout', 300);
  }

  async findByEmail(email: string, options?: FindOptionsWithoutWhere): Promise<AbandonedCheckout | null> {
    return this.findUnique({ email: email.toLowerCase() }, options);
  }
}
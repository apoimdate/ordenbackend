import { BlockedEmail, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BlockedEmailRepository extends BaseRepository<
  BlockedEmail,
  Prisma.BlockedEmailCreateInput,
  Prisma.BlockedEmailUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'blockedEmail', 300);
  }

  async findByEmail(email: string, options?: FindOptionsWithoutWhere): Promise<BlockedEmail | null> {
    return this.findUnique({ email: email.toLowerCase() }, options);
  }
}
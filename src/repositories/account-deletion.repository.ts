import { AccountDeletion, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class AccountDeletionRepository extends BaseRepository<
  AccountDeletion,
  Prisma.AccountDeletionCreateInput,
  Prisma.AccountDeletionUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'accountDeletion', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<AccountDeletion[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
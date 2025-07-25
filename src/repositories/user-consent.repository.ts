import { UserConsent, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class UserConsentRepository extends BaseRepository<
  UserConsent,
  Prisma.UserConsentCreateInput,
  Prisma.UserConsentUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'userConsent', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<UserConsent[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
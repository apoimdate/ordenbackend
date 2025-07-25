import { UserSearchPreference, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class UserSearchPreferenceRepository extends BaseRepository<
  UserSearchPreference,
  Prisma.UserSearchPreferenceCreateInput,
  Prisma.UserSearchPreferenceUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'userSearchPreference', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<UserSearchPreference[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
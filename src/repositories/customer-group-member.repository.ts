import { CustomerGroupMember, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CustomerGroupMemberRepository extends BaseRepository<
  CustomerGroupMember,
  Prisma.CustomerGroupMemberCreateInput,
  Prisma.CustomerGroupMemberUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'customerGroupMember', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<CustomerGroupMember[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
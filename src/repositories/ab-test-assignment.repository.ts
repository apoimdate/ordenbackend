import { AbTestAssignment, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class AbTestAssignmentRepository extends BaseRepository<
  AbTestAssignment,
  Prisma.AbTestAssignmentCreateInput,
  Prisma.AbTestAssignmentUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'abTestAssignment', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<AbTestAssignment[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
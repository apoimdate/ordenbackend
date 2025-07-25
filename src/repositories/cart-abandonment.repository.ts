import { CartAbandonment, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CartAbandonmentRepository extends BaseRepository<
  CartAbandonment,
  Prisma.CartAbandonmentCreateInput,
  Prisma.CartAbandonmentUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'cartAbandonment', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<CartAbandonment[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}
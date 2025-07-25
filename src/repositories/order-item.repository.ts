import { OrderItem, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class OrderItemRepository extends BaseRepository<
  OrderItem,
  Prisma.OrderItemCreateInput,
  Prisma.OrderItemUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'orderItem', 300);
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<OrderItem[]> {
    return this.findMany({
      ...options,
      where: {
        
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    });
  }
}
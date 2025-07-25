import { Cart, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CartRepository extends BaseRepository<
  Cart,
  Prisma.CartCreateInput,
  Prisma.CartUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'cart', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<Cart[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Cart[]> {
    return this.findMany({
      ...options,
      where: {
        
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  }

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Cart[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.findMany({
      ...options,
      where: {
        
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
  async findActiveByUserId(userId: string): Promise<Cart | null> {
    return this.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
  }

  async clearCart(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { cartId }
    });
    
    await this.update(cartId, {
      totalAmount: 0,
      totalItems: 0
    } as any);
  }
}
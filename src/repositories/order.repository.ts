import { Order, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class OrderRepository extends BaseRepository<
  Order,
  Prisma.OrderCreateInput,
  Prisma.OrderUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'order', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Order[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<Order[]> {
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
  ): Promise<Order[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Order[]> {
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

  async updateStatus(orderId: string, status: string): Promise<Order> {
    return this.update(orderId, { status, updatedAt: new Date() } as any);
  }

  async calculateTotalsByUser(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
  }> {
    const result = await this.aggregate({
      where: { userId },
      _count: true,
      _sum: {
        totalAmount: true
      }
    });

    return {
      totalOrders: result._count || 0,
      totalSpent: result._sum?.totalAmount || 0
    };
  }
}
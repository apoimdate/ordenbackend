import { Review, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ReviewRepository extends BaseRepository<
  Review,
  Prisma.ReviewCreateInput,
  Prisma.ReviewUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'review', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Review[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<Review[]> {
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
  ): Promise<Review[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Review[]> {
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
  async findByProductId(
    productId: string,
    options?: FindOptionsWithoutWhere
  ): Promise<Review[]> {
    return this.findMany({
      ...options,
      where: {
        
        productId
      },
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }

  async calculateAverageRating(productId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    const result = await this.aggregate({
      where: { productId },
      _avg: {
        rating: true
      },
      _count: true
    });

    return {
      averageRating: result._avg?.rating || 0,
      totalReviews: result._count || 0
    };
  }
}
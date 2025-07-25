import { Product, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ProductRepository extends BaseRepository<
  Product,
  Prisma.ProductCreateInput,
  Prisma.ProductUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'product', 300);
  }

  async findBySlug(slug: string, options?: FindOptionsWithoutWhere): Promise<Product | null> {
    return this.findUnique({ slug }, options);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Product[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<Product[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<Product[]> {
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

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Product[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Product[]> {
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
  async findPublished(options?: FindOptionsWithoutWhere): Promise<Product[]> {
    return this.findMany({
      ...options,
      where: {
        
        isPublished: true,
        isActive: true
      }
    });
  }

  async updateSearchScore(productId: string, score: number): Promise<Product> {
    return this.update(productId, { searchScore: score } as any);
  }

  async incrementView(productId: string): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) throw new Error('Product not found');
    
    return this.update(productId, {
      views: ((product as any).views || 0) + 1,
      searchPopularity: ((product as any).searchPopularity || 0) + 1
    } as any);
  }
}
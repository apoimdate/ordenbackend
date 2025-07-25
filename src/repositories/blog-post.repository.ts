import { BlogPost, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class BlogPostRepository extends BaseRepository<
  BlogPost,
  Prisma.BlogPostCreateInput,
  Prisma.BlogPostUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'blogPost', 300);
  }

  async findBySlug(slug: string, options?: FindOptionsWithoutWhere): Promise<BlogPost | null> {
    return this.findUnique({ slug }, options);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<BlogPost[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<BlogPost[]> {
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
}
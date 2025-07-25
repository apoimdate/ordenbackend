import { Category, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CategoryRepository extends BaseRepository<
  Category,
  Prisma.CategoryCreateInput,
  Prisma.CategoryUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'category', 300);
  }

  async findBySlug(slug: string, options?: FindOptionsWithoutWhere): Promise<Category | null> {
    return this.findUnique({ slug }, options);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<Category[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<Category[]> {
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

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<Category[]> {
    return this.findMany({
      ...options,
      where: {
        
        type
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Category[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Category[]> {
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
  async findRootCategories(options?: FindOptionsWithoutWhere): Promise<Category[]> {
    return this.findMany({
      ...options,
      where: {
        
        parentId: null
      }
    });
  }

  async findWithChildren(categoryId: string): Promise<Category | null> {
    return this.findById(categoryId, {
      include: {
        children: true
      }
    });
  }

  async getFullPath(categoryId: string): Promise<Category[]> {
    const path: Category[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.findById(currentId);
      if (!category) break;
      
      path.unshift(category);
      currentId = category.parentId;
    }

    return path;
  }
}
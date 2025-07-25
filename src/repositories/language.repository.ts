import { Language, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class LanguageRepository extends BaseRepository<
  Language,
  Prisma.LanguageCreateInput,
  Prisma.LanguageUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'language', 300);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<Language[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }

  async findByCode(code: string, options?: FindOptionsWithoutWhere): Promise<Language | null> {
    return this.findUnique({ code }, options);
  }

  async generateUniqueCode(prefix: string = ''): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<Language[]> {
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
  ): Promise<Language[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Language[]> {
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
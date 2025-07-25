import { Translation, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class TranslationRepository extends BaseRepository<
  Translation,
  Prisma.TranslationCreateInput,
  Prisma.TranslationUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'translation', 300);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Translation[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Translation[]> {
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
import { Report, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ReportRepository extends BaseRepository<
  Report,
  Prisma.ReportCreateInput,
  Prisma.ReportUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'report', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Report[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<Report[]> {
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

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<Report[]> {
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
  ): Promise<Report[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Report[]> {
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
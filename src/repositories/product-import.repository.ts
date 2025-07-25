import { ProductImport, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ProductImportRepository extends BaseRepository<
  ProductImport,
  Prisma.ProductImportCreateInput,
  Prisma.ProductImportUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'productImport', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<ProductImport[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findBySellerId(sellerId: string, options?: FindOptionsWithoutWhere): Promise<ProductImport[]> {
    return this.findMany({
      ...options,
      where: {
        
        sellerId
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<ProductImport[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<ProductImport[]> {
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
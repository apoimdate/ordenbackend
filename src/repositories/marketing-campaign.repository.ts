import { MarketingCampaign, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class MarketingCampaignRepository extends BaseRepository<
  MarketingCampaign,
  Prisma.MarketingCampaignCreateInput,
  Prisma.MarketingCampaignUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'marketingCampaign', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<MarketingCampaign[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async searchByName(name: string, options?: FindOptionsWithoutWhere): Promise<MarketingCampaign[]> {
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

  async findByType(type: string, options?: FindOptionsWithoutWhere): Promise<MarketingCampaign[]> {
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
  ): Promise<MarketingCampaign[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<MarketingCampaign[]> {
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
import { SupportTicket, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SupportTicketRepository extends BaseRepository<
  SupportTicket,
  Prisma.SupportTicketCreateInput,
  Prisma.SupportTicketUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'supportTicket', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<SupportTicket[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<SupportTicket[]> {
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
  ): Promise<SupportTicket[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<SupportTicket[]> {
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
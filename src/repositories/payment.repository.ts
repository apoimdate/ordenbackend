import { Payment, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class PaymentRepository extends BaseRepository<
  Payment,
  Prisma.PaymentCreateInput,
  Prisma.PaymentUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'payment', 300);
  }

  async findByStatus(status: string, options?: FindOptionsWithoutWhere): Promise<Payment[]> {
    return this.findMany({
      ...options,
      where: {
        
        status
      }
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<Payment[]> {
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

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<Payment[]> {
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
  async findPending(options?: FindOptionsWithoutWhere): Promise<Payment[]> {
    return this.findMany({
      ...options,
      where: {
        
        status: 'PENDING'
      }
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: string,
    transactionId?: string
  ): Promise<Payment> {
    const updateData: any = { status };
    if (transactionId) {
      updateData.transactionId = transactionId;
    }
    if (status === 'COMPLETED') {
      updateData.paidAt = new Date();
    }
    
    return this.update(paymentId, updateData);
  }
}
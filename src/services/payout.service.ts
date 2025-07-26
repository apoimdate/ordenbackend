import { FastifyInstance } from 'fastify';
import { Payout, Currency, Prisma, PrismaClient } from '@prisma/client';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';

export interface CreatePayoutData {
  sellerId: string;
  amount: number;
  currency?: Currency;
  method: string;
  reference?: string;
}

export interface PayoutWithDetails extends Payout {
  seller: {
    id: string;
    businessName: string;
    businessEmail: string;
  };
  transactions: any[];
}

export interface PayoutSearchParams {
  sellerId?: string;
  status?: string[];
  method?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'amount_asc' | 'amount_desc';
}

export class PayoutService extends CrudService<
  Payout,
  Prisma.PayoutCreateInput,
  Prisma.PayoutUpdateInput
> {
  public modelName: keyof PrismaClient = 'payout';

  constructor(app: FastifyInstance) {
    super(app);
  }

  async createPayout(data: CreatePayoutData): Promise<ServiceResult<Payout>> {
    try {
      // Validate seller exists
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId }
      });

      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Check seller has sufficient balance for payout (TODO: implement proper balance check)
      // const pendingPayouts = await this.prisma.payout.aggregate({
      //   where: {
      //     sellerId: data.sellerId,
      //     status: 'pending'
      //   },
      //   _sum: { amount: true }
      // });
      
      // Create payout
      const payout = await this.prisma.payout.create({
        data: {
          seller: { connect: { id: data.sellerId } },
          amount: data.amount,
          currency: data.currency || Currency.USD,
          method: data.method,
          reference: data.reference,
          status: 'pending'
        }
      });

      // TODO: Create corresponding transaction record when Transaction model is available
      // await this.prisma.transaction.create({
      //   data: {
      //     seller: { connect: { id: data.sellerId } },
      //     type: 'PAYOUT',
      //     amount: -data.amount, // Negative for outgoing
      //     status: 'pending',
      //     referenceId: payout.id,
      //     referenceType: 'PAYOUT',
      //     description: `Payout via ${data.method}`
      //   }
      // });

      // Clear cache
      await cache.invalidatePattern(`payouts:${data.sellerId}:*`);

      this.logger.info({ 
        payoutId: payout.id, 
        sellerId: data.sellerId,
        amount: data.amount,
        method: data.method
      }, 'Payout created successfully');

      return {
        success: true,
        data: payout
      };
    } catch (error: any) {
      this.logger.error({ err: error, data }, 'Failed to create payout');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create payout', 500, error.code, error.message)
      };
    }
  }

  async getById(payoutId: string, includeDetails: boolean = true): Promise<ServiceResult<PayoutWithDetails | Payout>> {
    try {
      const cacheKey = `payouts:${payoutId}:${includeDetails ? 'detailed' : 'basic'}`;
      const cached = await cache.get<PayoutWithDetails | Payout>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let payout;
      if (includeDetails) {
        payout = await this.prisma.payout.findUnique({
          where: { id: payoutId },
          include: {
            seller: {
              select: {
                id: true,
                businessName: true,
                businessEmail: true
              }
            }
          }
        });

        if (payout) {
          // TODO: Get related transactions when Transaction model is available
          // const transactions = await this.prisma.transaction.findMany({
          //   where: {
          //     referenceId: payoutId,
          //     referenceType: 'PAYOUT'
          //   }
          // });

          (payout as any).transactions = [];
        }
      } else {
        payout = await this.prisma.payout.findUnique({
          where: { id: payoutId }
        });
      }

      if (!payout) {
        return {
          success: false,
          error: new ApiError('Payout not found', 404, 'PAYOUT_NOT_FOUND')
        };
      }

      await cache.set(cacheKey, payout, { ttl: 300 });

      return {
        success: true,
        data: payout
      };
    } catch (error: any) {
      this.logger.error({ err: error, payoutId }, 'Failed to get payout');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get payout', 500, error.code, error.message)
      };
    }
  }

  async search(params: PayoutSearchParams): Promise<ServiceResult<PaginatedResult<PayoutWithDetails>>> {
    try {
      const cacheKey = `payouts:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<PayoutWithDetails>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.PayoutWhereInput = {};

      if (params.sellerId) {
        where.sellerId = params.sellerId;
      }

      if (params.status?.length) {
        where.status = { in: params.status };
      }

      if (params.method) {
        where.method = { contains: params.method, mode: 'insensitive' };
      }

      if (params.minAmount || params.maxAmount) {
        where.amount = {};
        if (params.minAmount) where.amount.gte = params.minAmount;
        if (params.maxAmount) where.amount.lte = params.maxAmount;
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      let orderBy: Prisma.PayoutOrderByWithRelationInput = { createdAt: 'desc' };
      switch (params.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'amount_asc':
          orderBy = { amount: 'asc' };
          break;
        case 'amount_desc':
          orderBy = { amount: 'desc' };
          break;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [payouts, total] = await Promise.all([
        this.prisma.payout.findMany({
          where,
          include: {
            seller: {
              select: {
                id: true,
                businessName: true,
                businessEmail: true
              }
            }
          },
          orderBy,
          skip,
          take: limit
        }),
        this.prisma.payout.count({ where })
      ]);

      // TODO: Get transactions for each payout when Transaction model is available
      const payoutsWithTransactions = payouts.map((payout) => ({
        ...payout,
        transactions: []
      }));

      const result: PaginatedResult<PayoutWithDetails> = {
        data: payoutsWithTransactions as PayoutWithDetails[],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

      await cache.set(cacheKey, result, { ttl: 300 });

      return { success: true, data: result };
    } catch (error: any) {
      this.logger.error({ err: error, params }, 'Failed to search payouts');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search payouts', 500, error.code, error.message)
      };
    }
  }

  async processPayout(payoutId: string): Promise<ServiceResult<Payout>> {
    try {
      const payout = await this.prisma.payout.findUnique({
        where: { id: payoutId },
        include: { seller: true }
      });

      if (!payout) {
        return {
          success: false,
          error: new ApiError('Payout not found', 404, 'PAYOUT_NOT_FOUND')
        };
      }

      if (payout.status !== 'pending') {
        return {
          success: false,
          error: new ApiError('Payout is not in pending status', 400, 'INVALID_PAYOUT_STATUS')
        };
      }

      // Process payout (integrate with payment processor here)
      const processedPayout = await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'completed',
          processedAt: new Date()
        }
      });

      // TODO: Update corresponding transaction when Transaction model is available
      // await this.prisma.transaction.updateMany({
      //   where: {
      //     referenceId: payoutId,
      //     referenceType: 'PAYOUT'
      //   },
      //   data: {
      //     status: 'completed'
      //   }
      // });

      // Clear cache
      await cache.invalidatePattern(`payouts:${payout.sellerId}:*`);

      this.logger.info({ 
        payoutId,
        sellerId: payout.sellerId,
        amount: payout.amount
      }, 'Payout processed successfully');

      return {
        success: true,
        data: processedPayout
      };
    } catch (error: any) {
      this.logger.error({ err: error, payoutId }, 'Failed to process payout');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to process payout', 500, error.code, error.message)
      };
    }
  }

  async cancelPayout(payoutId: string, reason?: string): Promise<ServiceResult<Payout>> {
    try {
      const payout = await this.prisma.payout.findUnique({
        where: { id: payoutId }
      });

      if (!payout) {
        return {
          success: false,
          error: new ApiError('Payout not found', 404, 'PAYOUT_NOT_FOUND')
        };
      }

      if (payout.status !== 'pending') {
        return {
          success: false,
          error: new ApiError('Only pending payouts can be cancelled', 400, 'INVALID_PAYOUT_STATUS')
        };
      }

      const cancelledPayout = await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'cancelled'
        }
      });

      // TODO: Update corresponding transaction when Transaction model is available
      // await this.prisma.transaction.updateMany({
      //   where: {
      //     referenceId: payoutId,
      //     referenceType: 'PAYOUT'
      //   },
      //   data: {
      //     status: 'cancelled',
      //     description: `Payout cancelled${reason ? `: ${reason}` : ''}`
      //   }
      // });

      // Clear cache
      await cache.invalidatePattern(`payouts:${payout.sellerId}:*`);

      this.logger.info({ 
        payoutId,
        sellerId: payout.sellerId,
        reason
      }, 'Payout cancelled');

      return {
        success: true,
        data: cancelledPayout
      };
    } catch (error: any) {
      this.logger.error({ err: error, payoutId, reason }, 'Failed to cancel payout');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to cancel payout', 500, error.code, error.message)
      };
    }
  }

  async getSellerPayouts(sellerId: string, params: PayoutSearchParams = {}): Promise<ServiceResult<PaginatedResult<Payout>>> {
    return this.search({ ...params, sellerId });
  }

  async getPayoutStats(sellerId?: string, dateFrom?: Date, dateTo?: Date): Promise<ServiceResult<any>> {
    try {
      const where: Prisma.PayoutWhereInput = {};
      
      if (sellerId) where.sellerId = sellerId;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [totalStats, statusStats] = await Promise.all([
        this.prisma.payout.aggregate({
          where,
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true }
        }),
        this.prisma.payout.groupBy({
          by: ['status'],
          where,
          _sum: { amount: true },
          _count: { id: true }
        })
      ]);

      const stats = {
        total: {
          count: totalStats._count.id || 0,
          amount: Number(totalStats._sum.amount || 0),
          average: Number(totalStats._avg.amount || 0)
        },
        byStatus: statusStats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: stat._count.id,
            amount: Number(stat._sum.amount || 0)
          };
          return acc;
        }, {} as Record<string, { count: number; amount: number }>)
      };

      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      this.logger.error({ err: error, sellerId }, 'Failed to get payout stats');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get payout stats', 500, error.code, error.message)
      };
    }
  }
}
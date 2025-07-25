import { Commission, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export interface CommissionCreateData {
  orderId: string;
  sellerId: string;
  rate: number;
  amount: number;
  status?: string;
  notes?: string;
}

export interface CommissionUpdateData {
  status?: string;
  paidAt?: Date;
  notes?: string;
}

export interface CommissionFilters {
  sellerId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface CommissionWithDetails extends Commission {
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  };
  seller?: {
    id: string;
    businessName: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export class CommissionRepository {
  protected prisma: PrismaClient;
  protected redis: Redis;
  protected logger: Logger;

  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
  }

  // Use BaseRepository's create method instead

  async findByIdWithDetails(id: string): Promise<CommissionWithDetails | null> {
    // Note: Relations are not defined in schema, returning basic commission data
    const commission = await this.prisma.commission.findUnique({
      where: { id }
    });
    
    return commission as CommissionWithDetails | null;
  }

  async findByOrderAndSeller(orderId: string, sellerId: string): Promise<Commission | null> {
    return this.prisma.commission.findFirst({
      where: {
        orderId,
        sellerId
      }
    });
  }

  async findMany(filters: CommissionFilters = {}, pagination = { page: 1, limit: 20 }) {
    const where: Prisma.CommissionWhereInput = {};

    if (filters.sellerId) {
      where.sellerId = filters.sellerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount.lte = filters.maxAmount;
      }
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [commissions, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit
      }),
      this.prisma.commission.count({ where })
    ]);

    return {
      commissions,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  // Use BaseRepository's update and delete methods instead

  async getCommissionStats(filters: CommissionFilters = {}) {
    const where: Prisma.CommissionWhereInput = {};

    if (filters.sellerId) where.sellerId = filters.sellerId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [
      totalCommissions,
      totalAmountResult,
      pendingAmountResult,
      paidAmountResult,
      avgRateResult,
      statusBreakdown
    ] = await Promise.all([
      this.prisma.commission.count({ where }),
      
      this.prisma.commission.aggregate({
        where,
        _sum: { amount: true }
      }),

      this.prisma.commission.aggregate({
        where: { ...where, status: 'pending' },
        _sum: { amount: true }
      }),

      this.prisma.commission.aggregate({
        where: { ...where, status: 'paid' },
        _sum: { amount: true }
      }),

      this.prisma.commission.aggregate({
        where,
        _avg: { rate: true }
      }),

      this.prisma.commission.groupBy({
        by: ['status'],
        where,
        _count: true
      })
    ]);

    return {
      totalCommissions,
      totalAmount: Number(totalAmountResult._sum.amount || 0),
      pendingAmount: Number(pendingAmountResult._sum.amount || 0),
      paidAmount: Number(paidAmountResult._sum.amount || 0),
      avgCommissionRate: Number(avgRateResult._avg.rate || 0),
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  async getSellerCommissionStats(sellerId: string) {
    return this.getCommissionStats({ sellerId });
  }

  async findPendingCommissions(): Promise<Commission[]> {
    return this.prisma.commission.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });
  }
}
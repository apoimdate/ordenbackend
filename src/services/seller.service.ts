import { Seller, SellerDocument, SellerAnalytics, SellerBadge, Prisma, SellerStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { 
  SellerRepository,
  UserRepository
} from "../repositories";
import { ServiceResult, PaginatedResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { updateSearchIndex } from '../utils/search';

interface CreateSellerData {
  userId: string;
  businessName: string;
  taxId?: string;
  contactPhone: string;
  contactEmail: string;
  commissionRate?: number;
}

// Removed unused interfaces

interface SellerSearchParams {
  query?: string;
  status?: string[];
  country?: string;
  state?: string;
  minRevenue?: number;
  maxRevenue?: number;
  dateJoined?: Date;
  isVerified?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
}

// Removed unused SellerDashboardData interface

// Unused interface - commented out
// interface SellerStats {
//   totalRevenue: number;
//   totalOrders: number;
//   totalProducts: number;
//   avgOrderValue: number;
//   conversionRate: number;
//   topProducts: Array<{
//     productId: string;
//     name: string;
//     revenue: number;
//     orders: number;
//   }>;
//   recentOrders: Array<{
//     orderId: string;
//     orderNumber: string;
//     customerEmail: string;
//     amount: number;
//     status: string;
//     createdAt: Date;
//   }>;
//   monthlyRevenue: Array<{
//     month: string;
//     revenue: number;
//     orders: number;
//   }>;
//   pendingActions: {
//     pendingOrders: number;
//     lowStockProducts: number;
//     pendingWithdrawals: number;
//     unreadMessages: number;
//   };
// }

interface SellerWithDetails extends Seller {
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  documents: SellerDocument[];
  analytics: SellerAnalytics[];
  badges: Array<{
    badge: SellerBadge;
    earnedAt: Date;
  }>;
  _count: {
    products: number;
    orders: number;
  };
}

export class SellerService extends CrudService<Seller> {
  modelName = 'seller' as const;

  private sellerRepo: SellerRepository;
  private userRepo: UserRepository;
  // Removed unused repositories

  constructor(app: FastifyInstance) {
    super(app);
    this.sellerRepo = new SellerRepository(this.prisma, this.app.redis, this.logger);
    this.userRepo = new UserRepository(this.prisma, this.app.redis, this.logger);
  }

  async create(data: CreateSellerData): Promise<ServiceResult<Seller>> {
    try {
      const user = await this.userRepo.findById(data.userId);
      if (!user) {
        return {
          success: false,
          error: new ApiError('User not found', 404, 'USER_NOT_FOUND')
        };
      }

      const existingSeller = await this.sellerRepo.findFirst({ where: { userId: data.userId } });
      if (existingSeller) {
        return {
          success: false,
          error: new ApiError('User is already a seller', 400, 'ALREADY_SELLER')
        };
      }

      const seller = await this.prisma.$transaction(async (tx) => {
        const newSeller = await tx.seller.create({
          data: {
            user: { connect: { id: data.userId } },
            businessName: data.businessName,
            businessEmail: data.contactEmail,
            businessPhone: data.contactPhone,
            taxId: data.taxId,
            commissionRate: data.commissionRate || 10,
            status: 'PENDING',
          }
        });

        await tx.user.update({
          where: { id: data.userId },
          data: { 
            role: 'SELLER'
          }
        });

        await tx.sellerAnalytics.create({
          data: {
            sellerId: newSeller.id,
            date: new Date(),
            revenue: 0,
            orders: 0,
            products: 0,
            views: 0,
            conversionRate: 0
          }
        });

        return newSeller;
      });

      await updateSearchIndex('sellers', {
        id: seller.id,
        userId: seller.userId,
        businessName: seller.businessName,
        status: seller.status,
        createdAt: seller.joinedAt.getTime()
      });

      this.app.log.info({ 
        sellerId: seller.id,
        userId: data.userId,
        businessName: seller.businessName 
      }, 'Seller created successfully');

      return {
        success: true,
        data: seller
      };
    } catch (error: any) {
      this.app.log.error({ err: error }, 'Failed to create seller');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create seller', 500, error.code, error.message)
      };
    }
  }

  async update(sellerId: string, data: Partial<CreateSellerData>): Promise<ServiceResult<Seller>> {
    try {
      const existingSeller = await this.sellerRepo.findById(sellerId);
      if (!existingSeller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      const seller = await this.sellerRepo.update(sellerId, {
        businessName: data.businessName,
        taxId: data.taxId,
        businessPhone: data.contactPhone,
        businessEmail: data.contactEmail,
        commissionRate: data.commissionRate,
      });

      await updateSearchIndex('sellers', {
        id: seller.id,
        businessName: seller.businessName,
        status: seller.status,
      });

      await cache.invalidatePattern(`sellers:${seller.id}:*`);

      this.app.log.info({ sellerId: seller.id }, 'Seller updated successfully');

      return {
        success: true,
        data: seller
      };
    } catch (error: any) {
      this.app.log.error({ err: error }, 'Failed to update seller');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to update seller', 500, error.code, error.message)
      };
    }
  }

  async getById(sellerId: string, includeDetails: boolean = true): Promise<ServiceResult<SellerWithDetails | Seller>> {
    try {
      const cacheKey = `sellers:${sellerId}:${includeDetails ? 'detailed' : 'basic'}`;
      const cached = await cache.get<SellerWithDetails | Seller>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let seller;
      if (includeDetails) {
        seller = await this.sellerRepo.findById(sellerId, {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            },
            documents: true,
            analytics: true,
            badges: {
              include: {
                badge: true
              }
            },
            _count: {
              select: {
                products: true,
                orders: true
              }
            }
          }
        });
      } else {
        seller = await this.sellerRepo.findById(sellerId);
      }

      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      await cache.set(cacheKey, JSON.stringify(seller), { ttl: 600 });

      return {
        success: true,
        data: seller
      };
    } catch (error: any) {
      this.app.log.error({ err: error }, 'Failed to get seller');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get seller', 500, error.code, error.message)
      };
    }
  }

  async search(params: SellerSearchParams): Promise<ServiceResult<PaginatedResult<SellerWithDetails>>> {
    try {
      const cacheKey = `sellers:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<SellerWithDetails>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.SellerWhereInput = {};

      if (params.query) {
        where.OR = [
          { businessName: { contains: params.query, mode: 'insensitive' } },
        ];
      }

      if (params.status?.length) {
        where.status = { in: params.status as SellerStatus[] };
      }

      // isVerified field not available in Seller model

      if (params.dateJoined) {
        where.joinedAt = { gte: params.dateJoined };
      }

      let orderBy: Prisma.SellerOrderByWithRelationInput = { joinedAt: 'desc' };
      switch (params.sortBy) {
        case 'oldest':
          orderBy = { joinedAt: 'asc' };
          break;
        case 'name_asc':
          orderBy = { businessName: 'asc' };
          break;
        case 'name_desc':
          orderBy = { businessName: 'desc' };
          break;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [sellers, total] = await Promise.all([
        this.sellerRepo.findMany({
          where,
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            },
            _count: {
              select: {
                products: true,
                orders: true
              }
            }
          },
          orderBy,
          skip,
          take: limit
        }),
        this.sellerRepo.count({ where })
      ]);

      const result: PaginatedResult<SellerWithDetails> = {
        data: sellers as unknown as SellerWithDetails[],
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
      this.app.log.error({ err: error }, 'Failed to search sellers');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search sellers', 500, error.code, error.message)
      };
    }
  }
}

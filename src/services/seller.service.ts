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

  // PRODUCTION: Comprehensive Seller Dashboard Analytics

  async getSellerDashboard(sellerId: string): Promise<ServiceResult<{
    seller: Seller;
    overview: {
      totalRevenue: number;
      totalOrders: number;
      totalProducts: number;
      activeProducts: number;
      averageOrderValue: number;
      conversionRate: number;
      customerCount: number;
      returnsRate: number;
    };
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      customerEmail: string;
      amount: number;
      status: string;
      itemCount: number;
      createdAt: Date;
    }>;
    topProducts: Array<{
      id: string;
      name: string;
      revenue: number;
      orders: number;
      averageRating: number;
      stock: number;
    }>;
    monthlyStats: Array<{
      month: string;
      revenue: number;
      orders: number;
      customers: number;
      averageOrderValue: number;
    }>;
    pendingActions: {
      pendingOrders: number;
      lowStockProducts: number;
      pendingPayments: number;
      unreadMessages: number;
      pendingReviews: number;
    };
    salesTrends: {
      last7Days: Array<{
        date: string;
        revenue: number;
        orders: number;
      }>;
      growthRate: {
        revenue: number; // percentage
        orders: number; // percentage
      };
    };
  }>> {
    try {
      const seller = await this.sellerRepo.findById(sellerId);
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Get seller products
      const products = await this.prisma.product.findMany({
        where: { sellerId },
        include: {
          _count: {
            select: {
              orderItems: true,
              reviews: true
            }
          },
          reviews: {
            select: { rating: true }
          }
        }
      });

      const productIds = products.map(p => p.id);
      const activeProducts = products.filter(p => p.status === 'PUBLISHED');

      // Get order items for this seller
      const orderItems = await this.prisma.orderItem.findMany({
        where: { productId: { in: productIds } },
        include: {
          order: {
            include: {
              user: {
                select: { email: true }
              }
            }
          },
          product: {
            select: { name: true }
          }
        }
      });

      // Calculate overview metrics
      const totalRevenue = orderItems.reduce((sum, item) => 
        sum + (parseFloat(item.price.toString()) * item.quantity), 0
      );

      const uniqueOrders = new Set(orderItems.map(item => item.orderId));
      const totalOrders = uniqueOrders.size;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const uniqueCustomers = new Set(orderItems.map(item => item.order.userId));
      const customerCount = uniqueCustomers.size;

      // Get product views for conversion rate
      const productViews = await this.prisma.productView.count({
        where: { productId: { in: productIds } }
      });
      const conversionRate = productViews > 0 ? (totalOrders / productViews) * 100 : 0;

      // Get returns for returns rate (using order-based returns)
      const orderIds = Array.from(uniqueOrders);
      const returns = await this.prisma.returnRequest.count({
        where: {
          orderId: { in: orderIds }
        }
      });
      const returnsRate = totalOrders > 0 ? (returns / totalOrders) * 100 : 0;

      // Recent orders (last 10) - get orders that contain seller's products
      const sellerOrderIds = Array.from(uniqueOrders).slice(0, 10);
      const recentOrderData = await this.prisma.order.findMany({
        where: {
          id: { in: sellerOrderIds }
        },
        include: {
          user: {
            select: { email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const recentOrders = recentOrderData.map(order => {
        // Count items for this seller in each order
        const sellerItemsInOrder = orderItems.filter(item => item.orderId === order.id);
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerEmail: order.user.email,
          amount: parseFloat(order.totalAmount.toString()),
          status: order.status,
          itemCount: sellerItemsInOrder.length,
          createdAt: order.createdAt
        };
      });

      // Top products by revenue
      const productSales: Record<string, {
        name: string;
        revenue: number;
        orders: number;
        ratings: number[];
        stock: number;
      }> = {};

      orderItems.forEach(item => {
        if (!productSales[item.productId]) {
          const product = products.find(p => p.id === item.productId);
          productSales[item.productId] = {
            name: product?.name || 'Unknown',
            revenue: 0,
            orders: 0,
            ratings: product?.reviews.map(r => r.rating) || [],
            stock: product?.quantity || 0
          };
        }
        productSales[item.productId].revenue += parseFloat(item.price.toString()) * item.quantity;
        productSales[item.productId].orders += 1;
      });

      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({
          id,
          name: data.name,
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders,
          averageRating: data.ratings.length > 0 
            ? Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 100) / 100 
            : 0,
          stock: data.stock
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Monthly stats (last 12 months)
      const monthlyStats: Array<{
        month: string;
        revenue: number;
        orders: number;
        customers: number;
        averageOrderValue: number;
      }> = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthOrderItems = orderItems.filter(item => 
          item.order.createdAt >= monthStart && item.order.createdAt <= monthEnd
        );

        const monthRevenue = monthOrderItems.reduce((sum, item) => 
          sum + (parseFloat(item.price.toString()) * item.quantity), 0
        );

        const monthOrders = new Set(monthOrderItems.map(item => item.orderId)).size;
        const monthCustomers = new Set(monthOrderItems.map(item => item.order.userId)).size;
        const monthAverageOrderValue = monthOrders > 0 ? monthRevenue / monthOrders : 0;

        monthlyStats.push({
          month: date.toISOString().substring(0, 7), // YYYY-MM format
          revenue: Math.round(monthRevenue * 100) / 100,
          orders: monthOrders,
          customers: monthCustomers,
          averageOrderValue: Math.round(monthAverageOrderValue * 100) / 100
        });
      }

      // Pending actions
      // Count pending orders containing seller's products
      const pendingOrderItems = orderItems.filter(item => 
        item.order.status === 'PENDING' || item.order.status === 'PROCESSING'
      );
      const pendingOrders = new Set(pendingOrderItems.map(item => item.orderId)).size;

      const lowStockProducts = products.filter(p => p.quantity <= p.lowStockAlert).length;

      const pendingPayments = await this.prisma.payout.count({
        where: {
          sellerId,
          status: 'PENDING'
        }
      });

      // Get unread messages for seller (simplified)
      const unreadMessages = await this.prisma.message.count({
        where: {
          senderId: { not: seller.userId },
          isRead: false
        }
      });

      const pendingReviews = await this.prisma.review.count({
        where: {
          product: { sellerId },
          status: 'PENDING'
        }
      });

      // Sales trends (last 7 days)
      const last7Days: Array<{
        date: string;
        revenue: number;
        orders: number;
      }> = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayOrderItems = orderItems.filter(item => 
          item.order.createdAt >= dayStart && item.order.createdAt <= dayEnd
        );

        const dayRevenue = dayOrderItems.reduce((sum, item) => 
          sum + (parseFloat(item.price.toString()) * item.quantity), 0
        );
        const dayOrders = new Set(dayOrderItems.map(item => item.orderId)).size;

        last7Days.push({
          date: dateStr,
          revenue: Math.round(dayRevenue * 100) / 100,
          orders: dayOrders
        });
      }

      // Calculate growth rates (current week vs previous week)
      const currentWeekRevenue = last7Days.reduce((sum, day) => sum + day.revenue, 0);
      const currentWeekOrders = last7Days.reduce((sum, day) => sum + day.orders, 0);

      // Previous 7 days for comparison
      const previousWeekStart = new Date();
      previousWeekStart.setDate(previousWeekStart.getDate() - 14);
      const previousWeekEnd = new Date();
      previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

      const previousWeekOrderItems = orderItems.filter(item => 
        item.order.createdAt >= previousWeekStart && item.order.createdAt <= previousWeekEnd
      );

      const previousWeekRevenue = previousWeekOrderItems.reduce((sum, item) => 
        sum + (parseFloat(item.price.toString()) * item.quantity), 0
      );
      const previousWeekOrders = new Set(previousWeekOrderItems.map(item => item.orderId)).size;

      const revenueGrowth = previousWeekRevenue > 0 
        ? ((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100 
        : 0;
      const ordersGrowth = previousWeekOrders > 0 
        ? ((currentWeekOrders - previousWeekOrders) / previousWeekOrders) * 100 
        : 0;

      return {
        success: true,
        data: {
          seller,
          overview: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalOrders,
            totalProducts: products.length,
            activeProducts: activeProducts.length,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100,
            customerCount,
            returnsRate: Math.round(returnsRate * 100) / 100
          },
          recentOrders,
          topProducts,
          monthlyStats,
          pendingActions: {
            pendingOrders,
            lowStockProducts,
            pendingPayments,
            unreadMessages,
            pendingReviews
          },
          salesTrends: {
            last7Days,
            growthRate: {
              revenue: Math.round(revenueGrowth * 100) / 100,
              orders: Math.round(ordersGrowth * 100) / 100
            }
          }
        }
      };
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller dashboard');
      return {
        success: false,
        error: new ApiError('Failed to get seller dashboard', 500, 'DASHBOARD_ERROR')
      };
    }
  }

  async getSellerPerformanceMetrics(sellerId: string, timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<ServiceResult<{
    period: { start: Date; end: Date };
    sales: {
      revenue: number;
      orders: number;
      items: number;
      averageOrderValue: number;
      refunds: number;
      refundRate: number;
    };
    customers: {
      total: number;
      new: number;
      returning: number;
      retention: number; // percentage
    };
    products: {
      totalViews: number;
      topPerforming: Array<{
        id: string;
        name: string;
        views: number;
        sales: number;
        conversion: number;
      }>;
    };
    comparisons: {
      revenueTrend: number; // percentage change vs previous period
      ordersTrend: number;
      customersTrend: number;
    };
    categoryBreakdown: Array<{
      categoryName: string;
      revenue: number;
      orders: number;
      percentage: number;
    }>;
  }>> {
    try {
      const seller = await this.sellerRepo.findById(sellerId);
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Calculate time periods
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Previous period for comparisons
      const previousEndDate = new Date(startDate);
      const previousStartDate = new Date(startDate);
      const periodLength = endDate.getTime() - startDate.getTime();
      previousStartDate.setTime(previousStartDate.getTime() - periodLength);

      // Get seller products
      const products = await this.prisma.product.findMany({
        where: { sellerId },
        include: {
          category: {
            select: { name: true }
          }
        }
      });
      const productIds = products.map(p => p.id);

      // Current period data
      const currentOrderItems = await this.prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            createdAt: { gte: startDate, lte: endDate }
          }
        },
        include: {
          order: {
            select: { userId: true, createdAt: true }
          },
          product: {
            select: { name: true }
          }
        }
      });

      // Previous period data
      const previousOrderItems = await this.prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            createdAt: { gte: previousStartDate, lte: previousEndDate }
          }
        },
        include: {
          order: {
            select: { userId: true }
          }
        }
      });

      // Calculate current period metrics
      const revenue = currentOrderItems.reduce((sum, item) => 
        sum + (parseFloat(item.price.toString()) * item.quantity), 0
      );
      
      const uniqueOrders = new Set(currentOrderItems.map(item => item.orderId));
      const orders = uniqueOrders.size;
      const items = currentOrderItems.reduce((sum, item) => sum + item.quantity, 0);
      const averageOrderValue = orders > 0 ? revenue / orders : 0;

      // Get refunds for seller's orders
      const sellerOrderIds = Array.from(uniqueOrders);
      const refunds = await this.prisma.refund.count({
        where: {
          orderId: { in: sellerOrderIds },
          createdAt: { gte: startDate, lte: endDate }
        }
      });
      const refundRate = orders > 0 ? (refunds / orders) * 100 : 0;

      // Customer metrics
      const allCustomerIds = new Set(currentOrderItems.map(item => item.order.userId));
      const totalCustomers = allCustomerIds.size;

      // Get customer order history to determine new vs returning
      const customerOrderHistory = await this.prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            createdAt: { lt: startDate }
          }
        },
        select: {
          order: {
            select: { userId: true }
          }
        }
      });

      const previousCustomerIds = new Set(customerOrderHistory.map(item => item.order.userId));
      const newCustomers = Array.from(allCustomerIds).filter(id => !previousCustomerIds.has(id)).length;
      const returningCustomers = totalCustomers - newCustomers;
      const retention = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

      // Product views and performance
      const productViews = await this.prisma.productView.count({
        where: {
          productId: { in: productIds },
          viewedAt: { gte: startDate, lte: endDate }
        }
      });

      // Top performing products
      const productPerformance: Record<string, {
        name: string;
        views: number;
        sales: number;
      }> = {};

      // Initialize with view data
      const viewData = await this.prisma.productView.findMany({
        where: {
          productId: { in: productIds },
          viewedAt: { gte: startDate, lte: endDate }
        }
      });

      // Map product names
      const productNameMap = new Map(products.map(p => [p.id, p.name]));

      viewData.forEach(view => {
        if (!productPerformance[view.productId]) {
          productPerformance[view.productId] = {
            name: productNameMap.get(view.productId) || 'Unknown',
            views: 0,
            sales: 0
          };
        }
        productPerformance[view.productId].views += 1;
      });

      // Add sales data
      currentOrderItems.forEach(item => {
        if (!productPerformance[item.productId]) {
          productPerformance[item.productId] = {
            name: item.product.name,
            views: 0,
            sales: 0
          };
        }
        productPerformance[item.productId].sales += item.quantity;
      });

      const topPerforming = Object.entries(productPerformance)
        .map(([id, data]) => ({
          id,
          name: data.name,
          views: data.views,
          sales: data.sales,
          conversion: data.views > 0 ? (data.sales / data.views) * 100 : 0
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      // Previous period comparisons
      const previousRevenue = previousOrderItems.reduce((sum, item) => 
        sum + (parseFloat(item.price.toString()) * item.quantity), 0
      );
      const previousOrders = new Set(previousOrderItems.map(item => item.orderId)).size;
      const previousCustomers = new Set(previousOrderItems.map(item => item.order.userId)).size;

      const revenueTrend = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0;
      const ordersTrend = previousOrders > 0 ? ((orders - previousOrders) / previousOrders) * 100 : 0;
      const customersTrend = previousCustomers > 0 ? ((totalCustomers - previousCustomers) / previousCustomers) * 100 : 0;

      // Category breakdown
      const categoryStats: Record<string, { revenue: number; orders: number }> = {};
      
      currentOrderItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const categoryName = product?.category?.name || 'Uncategorized';
        
        if (!categoryStats[categoryName]) {
          categoryStats[categoryName] = { revenue: 0, orders: 0 };
        }
        
        categoryStats[categoryName].revenue += parseFloat(item.price.toString()) * item.quantity;
        categoryStats[categoryName].orders += 1;
      });

      const categoryBreakdown = Object.entries(categoryStats)
        .map(([categoryName, stats]) => ({
          categoryName,
          revenue: Math.round(stats.revenue * 100) / 100,
          orders: stats.orders,
          percentage: revenue > 0 ? Math.round((stats.revenue / revenue) * 10000) / 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        success: true,
        data: {
          period: { start: startDate, end: endDate },
          sales: {
            revenue: Math.round(revenue * 100) / 100,
            orders,
            items,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            refunds,
            refundRate: Math.round(refundRate * 100) / 100
          },
          customers: {
            total: totalCustomers,
            new: newCustomers,
            returning: returningCustomers,
            retention: Math.round(retention * 100) / 100
          },
          products: {
            totalViews: productViews,
            topPerforming
          },
          comparisons: {
            revenueTrend: Math.round(revenueTrend * 100) / 100,
            ordersTrend: Math.round(ordersTrend * 100) / 100,
            customersTrend: Math.round(customersTrend * 100) / 100
          },
          categoryBreakdown
        }
      };
    } catch (error) {
      this.logger.error({ error, sellerId, timeframe }, 'Failed to get seller performance metrics');
      return {
        success: false,
        error: new ApiError('Failed to get performance metrics', 500, 'METRICS_ERROR')
      };
    }
  }

  async getSellerInventoryOverview(sellerId: string): Promise<ServiceResult<{
    summary: {
      totalProducts: number;
      activeProducts: number;
      draftProducts: number;
      outOfStockProducts: number;
      lowStockProducts: number;
      totalInventoryValue: number;
    };
    stockAlerts: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      alertThreshold: number;
      status: 'out_of_stock' | 'low_stock';
    }>;
    topSellingProducts: Array<{
      id: string;
      name: string;
      stock: number;
      sold30Days: number;
      revenue30Days: number;
      turnoverRate: number;
    }>;
    categoryDistribution: Array<{
      categoryName: string;
      productCount: number;
      totalValue: number;
      averagePrice: number;
    }>;
  }>> {
    try {
      const seller = await this.sellerRepo.findById(sellerId);
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Get all seller products with category info
      const products = await this.prisma.product.findMany({
        where: { sellerId },
        include: {
          category: {
            select: { name: true }
          },
          _count: {
            select: { orderItems: true }
          }
        }
      });

      // Calculate summary metrics
      const totalProducts = products.length;
      const activeProducts = products.filter(p => p.status === 'PUBLISHED').length;
      const draftProducts = products.filter(p => p.status === 'DRAFT').length;
      const outOfStockProducts = products.filter(p => p.quantity === 0).length;
      const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockAlert).length;
      
      const totalInventoryValue = products.reduce((sum, p) => 
        sum + (parseFloat(p.price.toString()) * p.quantity), 0
      );

      // Stock alerts
      const stockAlerts = products
        .filter(p => p.quantity <= p.lowStockAlert)
        .map(p => ({
          productId: p.id,
          productName: p.name,
          currentStock: p.quantity,
          alertThreshold: p.lowStockAlert,
          status: p.quantity === 0 ? 'out_of_stock' as const : 'low_stock' as const
        }))
        .sort((a, b) => a.currentStock - b.currentStock);

      // Get sales data for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const productIds = products.map(p => p.id);
      const recentSales = await this.prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            createdAt: { gte: thirtyDaysAgo }
          }
        }
      });

      // Calculate top selling products
      const productSales: Record<string, { sold: number; revenue: number }> = {};
      recentSales.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { sold: 0, revenue: 0 };
        }
        productSales[item.productId].sold += item.quantity;
        productSales[item.productId].revenue += parseFloat(item.price.toString()) * item.quantity;
      });

      const topSellingProducts = products
        .map(p => {
          const sales = productSales[p.id] || { sold: 0, revenue: 0 };
          const turnoverRate = p.quantity > 0 ? (sales.sold / (p.quantity + sales.sold)) * 100 : 0;
          
          return {
            id: p.id,
            name: p.name,
            stock: p.quantity,
            sold30Days: sales.sold,
            revenue30Days: Math.round(sales.revenue * 100) / 100,
            turnoverRate: Math.round(turnoverRate * 100) / 100
          };
        })
        .sort((a, b) => b.sold30Days - a.sold30Days)
        .slice(0, 10);

      // Category distribution
      const categoryStats: Record<string, {
        count: number;
        totalValue: number;
        prices: number[];
      }> = {};

      products.forEach(p => {
        const categoryName = p.category?.name || 'Uncategorized';
        if (!categoryStats[categoryName]) {
          categoryStats[categoryName] = { count: 0, totalValue: 0, prices: [] };
        }
        
        categoryStats[categoryName].count += 1;
        const productValue = parseFloat(p.price.toString()) * p.quantity;
        categoryStats[categoryName].totalValue += productValue;
        categoryStats[categoryName].prices.push(parseFloat(p.price.toString()));
      });

      const categoryDistribution = Object.entries(categoryStats)
        .map(([categoryName, stats]) => ({
          categoryName,
          productCount: stats.count,
          totalValue: Math.round(stats.totalValue * 100) / 100,
          averagePrice: stats.prices.length > 0 
            ? Math.round((stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length) * 100) / 100 
            : 0
        }))
        .sort((a, b) => b.totalValue - a.totalValue);

      return {
        success: true,
        data: {
          summary: {
            totalProducts,
            activeProducts,
            draftProducts,
            outOfStockProducts,
            lowStockProducts,
            totalInventoryValue: Math.round(totalInventoryValue * 100) / 100
          },
          stockAlerts,
          topSellingProducts,
          categoryDistribution
        }
      };
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller inventory overview');
      return {
        success: false,
        error: new ApiError('Failed to get inventory overview', 500, 'INVENTORY_ERROR')
      };
    }
  }
}

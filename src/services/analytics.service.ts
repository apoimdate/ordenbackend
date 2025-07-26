import { AnalyticsEvent, Prisma, Currency } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { 
  AnalyticsEventRepository,
  OrderRepository,
  PaymentRepository,
  UserRepository
} from "../repositories";
import { ServiceResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { OrderStatus } from '../utils/constants';

interface CreateAnalyticsEventData {
  type: string;
  data: Prisma.JsonValue;
  userId?: string;
  productId?: string;
  sellerId?: string;
}

interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

interface AnalyticsFilters {
  userId?: string;
  sellerId?: string;
  productId?: string;
  orderId?: string;
  eventType?: string;
  eventCategory?: string;
  currency?: Currency;
  dateRange?: AnalyticsDateRange;
}

interface DashboardAnalytics {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    totalUsers: number;
    totalSellers: number;
    avgOrderValue: number;
    conversionRate: number;
  };
  revenueChart: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    revenue: number;
    orders: number;
    views: number;
  }>;
  topSellers: Array<{
    sellerId: string;
    storeName: string;
    revenue: number;
    orders: number;
  }>;
  userMetrics: {
    newUsers: number;
    activeUsers: number;
    returningUsers: number;
    userGrowthRate: number;
  };
  geographicData: Array<{
    country: string;
    users: number;
    revenue: number;
  }>;
}

interface UserAnalyticsData {
  userId: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  favoriteCategories: Array<{
    categoryId: string;
    categoryName: string;
    orderCount: number;
  }>;
  sessionMetrics: {
    totalSessions: number;
    avgSessionDuration: number;
    pageViews: number;
    bounceRate: number;
  };
}

interface SellerAnalyticsData {
  sellerId: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  revenue: number;
  orders: number;
  customers: number;
  views: number;
  conversionRate: number;
  avgOrderValue: number;
  topProducts: Array<{
    productId: string;
    name: string;
    revenue: number;
    orders: number;
  }>;
  revenueByCategory: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
  }>;
}

interface ProductAnalyticsData {
  productId: string;
  views: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgRating: number;
  reviewCount: number;
  cartAdditions: number;
  wishlistAdditions: number;
  searchRanking: number;
}

interface ReportOptions {
  type: 'sales' | 'users' | 'products' | 'sellers' | 'traffic' | 'financial';
  format: 'json' | 'csv' | 'pdf';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  dateRange?: AnalyticsDateRange;
  filters?: AnalyticsFilters;
  groupBy?: string[];
  metrics?: string[];
}

export class AnalyticsService extends CrudService<AnalyticsEvent, Prisma.AnalyticsEventCreateInput, Prisma.AnalyticsEventUpdateInput> {
  modelName = 'analyticsEvent' as const;

  private analyticsEventRepo: AnalyticsEventRepository;
  private orderRepo: OrderRepository;
  private paymentRepo: PaymentRepository;
  private userRepo: UserRepository;

  constructor(app: FastifyInstance) {
    super(app);
    this.analyticsEventRepo = new AnalyticsEventRepository(app.prisma, app.redis, this.logger);
    this.orderRepo = new OrderRepository(app.prisma, app.redis, this.logger);
    this.paymentRepo = new PaymentRepository(app.prisma, app.redis, this.logger);
    this.userRepo = new UserRepository(app.prisma, app.redis, this.logger);
  }

  // Event Tracking
  async trackEvent(data: CreateAnalyticsEventData): Promise<ServiceResult<AnalyticsEvent>> {
    try {
      const event = await this.analyticsEventRepo.trackEvent({
        type: data.type,
        userId: data.userId,
        productId: data.productId,
        sellerId: data.sellerId,
        data: data.data
      });

      if (!event) {
        return {
          success: false,
          error: new ApiError('Failed to create analytics event', 500)
        };
      }

      // Process event for real-time analytics updates
      await this.processEventForAnalytics(event);

      this.logger.info({ 
        eventId: event.id, 
        eventType: data.type, 
        userId: data.userId 
      }, 'Analytics event tracked');

      return {
        success: true,
        data: event
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to track analytics event');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to track analytics event', 500)
      };
    }
  }

  // Dashboard PlatformAnalytics
  async getDashboardAnalytics(dateRange: AnalyticsDateRange): Promise<ServiceResult<DashboardAnalytics>> {
    try {
      const cacheKey = `analytics:dashboard:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;
      const cached = await cache.get<DashboardAnalytics>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const [
        overview,
        revenueChart,
        topProducts,
        topSellers,
        userMetrics,
        geographicData
      ] = await Promise.all([
        this.getOverviewMetrics(dateRange),
        this.getRevenueChart(),
        this.getTopProducts(),
        this.getTopSellers(),
        this.getUserMetrics(),
        this.getGeographicData()
      ]);

      const dashboardData: DashboardAnalytics = {
        overview,
        revenueChart,
        topProducts,
        topSellers,
        userMetrics,
        geographicData
      };

      // Cache for 15 minutes
      await cache.set(cacheKey, dashboardData, { ttl: 900 });

      return {
        success: true,
        data: dashboardData
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get dashboard analytics');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get dashboard analytics', 500)
      };
    }
  }

  // User PlatformAnalytics
  async getUserAnalytics(userId: string, dateRange?: AnalyticsDateRange): Promise<ServiceResult<UserAnalyticsData>> {
    try {
      const cacheKey = `analytics:user:${userId}:${dateRange ? `${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}` : 'all'}`;
      const cached = await cache.get<UserAnalyticsData>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const whereClause: any = { userId };
      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        };
      }

      const [
        orderStats,
        sessionMetrics,
        favoriteCategories
      ] = await Promise.all([
        this.getUserOrderStats(userId),
        this.getUserSessionMetrics(userId),
        this.getUserFavoriteCategories(userId)
      ]);

      const userAnalytics = {
        userId,
        ...orderStats,
        favoriteCategories,
        sessionMetrics
      } as UserAnalyticsData;

      // Cache for 30 minutes
      await cache.set(cacheKey, userAnalytics, { ttl: 1800 });

      return {
        success: true,
        data: userAnalytics
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get user analytics');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get user analytics', 500)
      };
    }
  }

  // Seller PlatformAnalytics
  async getSellerAnalytics(
    sellerId: string, 
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
    dateRange?: AnalyticsDateRange
  ): Promise<ServiceResult<SellerAnalyticsData>> {
    try {
      const cacheKey = `analytics:seller:${sellerId}:${period}:${dateRange ? `${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}` : 'all'}`;
      const cached = await cache.get<SellerAnalyticsData>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const [
        basicMetrics,
        topProducts,
        revenueByCategory
      ] = await Promise.all([
        this.getSellerBasicMetrics(sellerId, dateRange),
        this.getSellerTopProducts(sellerId, dateRange),
        this.getSellerRevenueByCategory(sellerId, dateRange)
      ]);

      const sellerAnalytics = {
        sellerId,
        period,
        ...basicMetrics,
        topProducts,
        revenueByCategory
      } as SellerAnalyticsData;

      // Cache for 30 minutes
      await cache.set(cacheKey, sellerAnalytics, { ttl: 1800 });

      return {
        success: true,
        data: sellerAnalytics
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get seller analytics');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get seller analytics', 500)
      };
    }
  }

  // Product PlatformAnalytics
  async getProductAnalytics(productId: string, dateRange?: AnalyticsDateRange): Promise<ServiceResult<ProductAnalyticsData>> {
    try {
      const cacheKey = `analytics:product:${productId}:${dateRange ? `${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}` : 'all'}`;
      const cached = await cache.get<ProductAnalyticsData>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const [
        basicMetrics,
        interactions
      ] = await Promise.all([
        this.getProductBasicMetrics(productId, dateRange),
        this.getProductInteractions(productId, dateRange)
      ]);

      const productAnalytics = {
        productId,
        ...basicMetrics,
        ...interactions
      } as ProductAnalyticsData;

      // Cache for 30 minutes
      await cache.set(cacheKey, productAnalytics, { ttl: 1800 });

      return {
        success: true,
        data: productAnalytics
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get product analytics');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get product analytics', 500)
      };
    }
  }

  // Reports Generation
  async generateReport(options: ReportOptions): Promise<ServiceResult<any>> {
    try {
      let data;

      switch (options.type) {
        case 'sales':
          data = await this.generateSalesReport(options);
          break;
        case 'users':
          data = await this.generateUsersReport(options);
          break;
        case 'products':
          data = await this.generateProductsReport(options);
          break;
        case 'sellers':
          data = await this.generateSellersReport(options);
          break;
        case 'traffic':
          data = await this.generateTrafficReport(options);
          break;
        case 'financial':
          data = await this.generateFinancialReport(options);
          break;
        default:
          return {
            success: false,
            error: new ApiError('Invalid report type', 400, 'INVALID_REPORT_TYPE')
          };
      }

      const report = {
        type: options.type,
        format: options.format,
        period: options.period,
        dateRange: options.dateRange,
        generatedAt: new Date(),
        data
      };

      this.logger.info({ 
        reportType: options.type, 
        format: options.format 
      }, 'Report generated');

      return {
        success: true,
        data: report
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to generate report');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to generate report', 500)
      };
    }
  }

  // Private helper methods
  private async processEventForAnalytics(event: AnalyticsEvent): Promise<void> {
    // Update user analytics
    if (event.userId) {
      await this.updateUserAnalytics(event);
    }

    // Update seller analytics
    if (event.sellerId) {
      await this.updateSellerAnalytics(event);
    }

    // Update product analytics
    if (event.productId) {
      await this.updateProductAnalytics(event);
    }
  }

  private async updateUserAnalytics(event: AnalyticsEvent): Promise<void> {
    if (!event.userId) return;

    try {
      // Update user engagement metrics in cache for real-time access
      const cacheKey = `user:analytics:${event.userId}:${new Date().toISOString().split('T')[0]}`;
      const existing = await this.app.redis.get(cacheKey);
      const metrics = existing ? JSON.parse(existing) : { events: 0, pageViews: 0, lastActivity: null };

      metrics.events += 1;
      if (event.type === 'PAGE_VIEW') metrics.pageViews += 1;
      metrics.lastActivity = event.createdAt;

      await this.app.redis.setex(cacheKey, 86400, JSON.stringify(metrics)); // Cache for 24 hours
    } catch (error) {
      this.logger.warn({ error, userId: event.userId }, 'Failed to update user analytics cache');
    }
  }

  private async updateSellerAnalytics(event: AnalyticsEvent): Promise<void> {
    if (!event.sellerId) return;

    try {
      // Update seller metrics in cache for real-time dashboard
      const cacheKey = `seller:analytics:${event.sellerId}:${new Date().toISOString().split('T')[0]}`;
      const existing = await this.app.redis.get(cacheKey);
      const metrics = existing ? JSON.parse(existing) : { views: 0, orders: 0, revenue: 0 };

      if (event.type === 'PRODUCT_VIEW') metrics.views += 1;
      if (event.type === 'PURCHASE' && event.data && typeof event.data === 'object' && 'value' in event.data) {
        metrics.orders += 1;
        metrics.revenue += parseFloat(String(event.data.value));
      }

      await this.app.redis.setex(cacheKey, 86400, JSON.stringify(metrics)); // Cache for 24 hours
    } catch (error) {
      this.logger.warn({ error, sellerId: event.sellerId }, 'Failed to update seller analytics cache');
    }
  }

  private async updateProductAnalytics(event: AnalyticsEvent): Promise<void> {
    if (!event.productId) return;

    try {
      // Update product metrics in cache for real-time analytics
      const cacheKey = `product:analytics:${event.productId}:${new Date().toISOString().split('T')[0]}`;
      const existing = await this.app.redis.get(cacheKey);
      const metrics = existing ? JSON.parse(existing) : { 
        views: 0, 
        cartAdditions: 0, 
        orders: 0, 
        revenue: 0 
      };

      if (event.type === 'PRODUCT_VIEW') metrics.views += 1;
      if (event.type === 'ADD_TO_CART') metrics.cartAdditions += 1;
      if (event.type === 'PURCHASE' && event.data && typeof event.data === 'object' && 'value' in event.data) {
        metrics.orders += 1;
        metrics.revenue += parseFloat(String(event.data.value));
      }

      await this.app.redis.setex(cacheKey, 86400, JSON.stringify(metrics)); // Cache for 24 hours
    } catch (error) {
      this.logger.warn({ error, productId: event.productId }, 'Failed to update product analytics cache');
    }
  }

  private async getOverviewMetrics(dateRange?: AnalyticsDateRange): Promise<DashboardAnalytics['overview']> {
    const [
      revenueData,
      ordersData,
      usersData,
      sellersData
    ] = await Promise.all([
      this.paymentRepo.aggregate({
        where: dateRange ? {
          status: 'PAID',
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
        } : { status: 'PAID' },
        _sum: { amount: true },
      }),
      this.orderRepo.count(dateRange ? {
        where: {
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
        }
      } : {}),
      this.userRepo.count(dateRange ? {
        where: {
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
        }
      } : {}),
      this.prisma.seller.count(dateRange ? {
        where: {
          joinedAt: { gte: dateRange.startDate, lte: dateRange.endDate }
        }
      } : undefined)
    ]);

    const totalRevenue = Number(revenueData._sum.amount || 0);
    const totalOrders = ordersData;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      totalUsers: usersData,
      totalSellers: sellersData,
      avgOrderValue,
      conversionRate: 0 // Would calculate based on sessions vs orders
    };
  }

  private async getRevenueChart(): Promise<DashboardAnalytics['revenueChart']> {
    try {
      // Get revenue chart data from analytics repository
      const { AnalyticsRepository } = require('../repositories/analytics.repository');
      const analyticsRepo = new AnalyticsRepository(
        this.prisma, 
        this.app.redis, 
        this.logger
      );
      
      return await analyticsRepo.getRevenueChart('month');
    } catch (error) {
      this.logger.error({ error }, 'Failed to get revenue chart data');
      return [];
    }
  }

  private async getTopProducts(): Promise<DashboardAnalytics['topProducts']> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Get top products based on order performance
      const topProducts = await this.prisma.product.findMany({
        include: {
          orderItems: {
            where: {
              order: {
                status: 'DELIVERED',
                createdAt: { gte: thirtyDaysAgo }
              }
            },
            select: {
              quantity: true,
              price: true
            }
          }
        },
        take: 20 // Get more initially, then filter
      });

      // Get view counts separately
      const productIds = topProducts.map(p => p.id);
      const viewCounts = await this.prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          type: 'PRODUCT_VIEW',
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: { id: true }
      });

      // Create view count map
      const viewCountMap = new Map(
        viewCounts.map(vc => [vc.productId, vc._count.id || 0])
      );

      const productsWithMetrics = topProducts.map((product: any) => {
        const revenue = product.orderItems.reduce((sum: number, item: any) => 
          sum + (Number(item.price) * item.quantity), 0);
        const orders = product.orderItems.length;
        const views = viewCountMap.get(product.id) || 0;

        return {
          productId: product.id,
          name: product.name,
          revenue,
          orders,
          views
        };
      })
      .filter(p => p.revenue > 0) // Only products with sales
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10

      return productsWithMetrics;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get top products');
      return [];
    }
  }

  private async getTopSellers(): Promise<DashboardAnalytics['topSellers']> {
    try {
      // Get top sellers based on order performance
      const topSellers = await this.prisma.seller.findMany({
        include: {
          products: {
            include: {
              orderItems: {
                where: {
                  order: {
                    status: 'DELIVERED',
                    createdAt: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                  }
                },
                select: {
                  quantity: true,
                  price: true
                }
              }
            }
          }
        },
        take: 10
      });

      return topSellers.map((seller: any) => {
        let revenue = 0;
        let orders = 0;

        seller.products.forEach((product: any) => {
          product.orderItems.forEach((item: any) => {
            revenue += Number(item.price) * item.quantity;
            orders += 1;
          });
        });

        return {
          sellerId: seller.id,
          storeName: seller.businessName,
          revenue,
          orders
        };
      })
      .filter(seller => seller.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
      this.logger.error({ error }, 'Failed to get top sellers');
      return [];
    }
  }

  private async getUserMetrics(): Promise<DashboardAnalytics['userMetrics']> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const [
        newUsersCount,
        activeUsersCount,
        previousPeriodUsers,
        returningUsersCount
      ] = await Promise.all([
        // New users in last 30 days
        this.prisma.user.count({
          where: {
            createdAt: { gte: thirtyDaysAgo }
          }
        }),
        // Active users (with analytics events) in last 30 days
        this.prisma.analyticsEvent.aggregate({
          where: {
            type: 'SESSION_START',
            createdAt: { gte: thirtyDaysAgo }
          },
          _count: { userId: true }
        }),
        // Users from previous 30-day period (for growth rate)
        this.prisma.user.count({
          where: {
            createdAt: { 
              gte: sixtyDaysAgo,
              lt: thirtyDaysAgo 
            }
          }
        }),
        // Returning users (users who have orders in multiple periods)
        this.prisma.user.count({
          where: {
            orders: {
              some: {
                createdAt: { gte: thirtyDaysAgo }
              }
            },
            createdAt: { lt: thirtyDaysAgo }
          }
        })
      ]);

      // Calculate user growth rate
      const userGrowthRate = previousPeriodUsers > 0 
        ? ((newUsersCount - previousPeriodUsers) / previousPeriodUsers) * 100 
        : 0;

      return {
        newUsers: newUsersCount,
        activeUsers: activeUsersCount._count.userId || 0,
        returningUsers: returningUsersCount,
        userGrowthRate: Math.round(userGrowthRate * 100) / 100
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get user metrics');
      return {
        newUsers: 0,
        activeUsers: 0,
        returningUsers: 0,
        userGrowthRate: 0
      };
    }
  }

  private async getGeographicData(): Promise<DashboardAnalytics['geographicData']> {
    try {
      // For now, return placeholder data since geographic fields are not in current schema
      // In a real implementation, you would extract country from shipping addresses or IP geolocation

      // Mock geographic distribution based on order data
      const mockCountries = [
        { country: 'United States', users: 45, revenue: 12500 },
        { country: 'Canada', users: 25, revenue: 8200 },
        { country: 'United Kingdom', users: 18, revenue: 6400 },
        { country: 'Australia', users: 12, revenue: 4100 },
        { country: 'Germany', users: 15, revenue: 5800 }
      ];

      return mockCountries.sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
      this.logger.error({ error }, 'Failed to get geographic data');
      return [];
    }
  }

  private async getUserOrderStats(userId: string): Promise<Partial<UserAnalyticsData>> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { 
          userId,
          status: { in: [OrderStatus.DELIVERED] }
        },
        select: {
          totalAmount: true
        }
      });

      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      return {
        totalOrders,
        totalSpent,
        avgOrderValue
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user order stats');
      return {
        totalOrders: 0,
        totalSpent: 0,
        avgOrderValue: 0
      };
    }
  }

  private async getUserSessionMetrics(userId: string): Promise<UserAnalyticsData['sessionMetrics']> {
    try {
      // Get analytics events for this user
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          userId,
          type: { in: ['PAGE_VIEW', 'SESSION_START', 'SESSION_END'] }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Calculate metrics from events
      const sessionStarts = events.filter(e => e.type === 'SESSION_START').length;
      const pageViews = events.filter(e => e.type === 'PAGE_VIEW').length;
      
      // For now, return basic metrics
      return {
        totalSessions: sessionStarts,
        avgSessionDuration: 0, // Would need session end events to calculate
        pageViews,
        bounceRate: 0
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user session metrics');
      return {
        totalSessions: 0,
        avgSessionDuration: 0,
        pageViews: 0,
        bounceRate: 0
      };
    }
  }

  private async getUserFavoriteCategories(userId: string): Promise<UserAnalyticsData['favoriteCategories']> {
    try {
      // Get user's orders with product categories
      const orders = await this.prisma.order.findMany({
        where: {
          userId,
          status: { in: [OrderStatus.DELIVERED] }
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Count orders by category
      const categoryMap = new Map<string, { name: string; count: number }>();
      
      for (const order of orders as any[]) {
        for (const item of order.items) {
          if (item.product?.category) {
            const catId = item.product.category.id;
            const catName = item.product.category.name;
            
            if (categoryMap.has(catId)) {
              categoryMap.get(catId)!.count++;
            } else {
              categoryMap.set(catId, { name: catName, count: 1 });
            }
          }
        }
      }

      // Convert to array and sort by count
      const favoriteCategories = Array.from(categoryMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          orderCount: data.count
        }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 5); // Top 5 categories

      return favoriteCategories;
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user favorite categories');
      return [];
    }
  }

  private async getSellerBasicMetrics(sellerId: string, _dateRange?: AnalyticsDateRange): Promise<Partial<SellerAnalyticsData>> {
    try {
      // Get seller's orders and revenue
      const orders = await this.prisma.order.findMany({
        where: {
          items: {
            some: {
              product: {
                sellerId
              }
            }
          },
          status: { in: [OrderStatus.DELIVERED] }
        },
        include: {
          items: {
            where: {
              product: {
                sellerId
              }
            }
          }
        }
      });

      // Calculate metrics
      const revenue = orders.reduce((sum, order: any) => {
        const sellerRevenue = order.items.reduce((itemSum: number, item: any) => {
          return itemSum + (Number(item.price) * item.quantity);
        }, 0);
        return sum + sellerRevenue;
      }, 0);

      const orderCount = orders.length;
      const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      // Get unique customers
      const uniqueCustomers = new Set(orders.map(order => order.userId)).size;

      // Get product views (from analytics events)
      const viewEvents = await this.prisma.analyticsEvent.count({
        where: {
          sellerId,
          type: 'PRODUCT_VIEW'
        }
      });

      // Calculate conversion rate
      const conversionRate = viewEvents > 0 ? (orderCount / viewEvents) * 100 : 0;

      return {
        revenue,
        orders: orderCount,
        customers: uniqueCustomers,
        views: viewEvents,
        conversionRate,
        avgOrderValue
      };
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller basic metrics');
      return {
        revenue: 0,
        orders: 0,
        customers: 0,
        views: 0,
        conversionRate: 0,
        avgOrderValue: 0
      };
    }
  }

  private async getSellerTopProducts(sellerId: string, _dateRange?: AnalyticsDateRange): Promise<SellerAnalyticsData['topProducts']> {
    try {
      // Get seller's products with order counts
      const products = await this.prisma.product.findMany({
        where: {
          sellerId,
          status: 'PUBLISHED'
        },
        include: {
          orderItems: {
            where: {
              order: {
                status: { in: [OrderStatus.DELIVERED] }
              }
            },
            select: {
              quantity: true,
              price: true
            }
          }
        }
      });

      // Calculate revenue and order count for each product
      const productStats = products.map((product: any) => {
        const stats = product.orderItems.reduce((acc: any, item: any) => ({
          revenue: acc.revenue + (Number(item.price) * item.quantity),
          orders: acc.orders + 1
        }), { revenue: 0, orders: 0 });

        return {
          productId: product.id,
          name: product.name,
          revenue: stats.revenue,
          orders: stats.orders
        };
      });

      // Sort by revenue and return top 10
      return productStats
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller top products');
      return [];
    }
  }

  private async getSellerRevenueByCategory(sellerId: string, _dateRange?: AnalyticsDateRange): Promise<SellerAnalyticsData['revenueByCategory']> {
    try {
      // Get seller's orders grouped by category
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          product: {
            sellerId
          },
          order: {
            status: { in: [OrderStatus.DELIVERED] }
          }
        },
        include: {
          product: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      // Group revenue by category
      const categoryMap = new Map<string, { name: string; revenue: number }>();
      
      for (const item of orderItems) {
        if (item.product?.category) {
          const catId = item.product.category.id;
          const catName = item.product.category.name;
          const itemRevenue = Number(item.price) * item.quantity;
          
          if (categoryMap.has(catId)) {
            categoryMap.get(catId)!.revenue += itemRevenue;
          } else {
            categoryMap.set(catId, { name: catName, revenue: itemRevenue });
          }
        }
      }

      // Convert to array and sort by revenue
      return Array.from(categoryMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          revenue: data.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller revenue by category');
      return [];
    }
  }

  private async getProductBasicMetrics(productId: string, _dateRange?: AnalyticsDateRange): Promise<Partial<ProductAnalyticsData>> {
    try {
      // Get product views from analytics events
      const views = await this.prisma.analyticsEvent.count({
        where: {
          productId,
          type: 'PRODUCT_VIEW'
        }
      });

      // Get orders and revenue
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          productId,
          order: {
            status: { in: [OrderStatus.DELIVERED] }
          }
        },
        select: {
          quantity: true,
          price: true
        }
      });

      const orders = orderItems.length;
      const revenue = orderItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      const conversionRate = views > 0 ? (orders / views) * 100 : 0;

      // Get reviews
      const reviews = await this.prisma.review.aggregate({
        where: { productId },
        _count: true,
        _avg: { rating: true }
      });

      return {
        views,
        orders,
        revenue,
        conversionRate,
        avgRating: reviews._avg.rating || 0,
        reviewCount: reviews._count,
        searchRanking: 0 // Would need search analytics to calculate
      };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to get product basic metrics');
      return {
        views: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0,
        avgRating: 0,
        reviewCount: 0,
        searchRanking: 0
      };
    }
  }

  private async getProductInteractions(productId: string, _dateRange?: AnalyticsDateRange): Promise<Partial<ProductAnalyticsData>> {
    try {
      // Get cart additions from analytics events
      const cartAdditions = await this.prisma.analyticsEvent.count({
        where: {
          productId,
          type: 'ADD_TO_CART'
        }
      });

      // Get wishlist additions
      const wishlistAdditions = await this.prisma.wishlist.count({
        where: {
          productId
        }
      });

      return {
        cartAdditions,
        wishlistAdditions
      };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to get product interactions');
      return {
        cartAdditions: 0,
        wishlistAdditions: 0
      };
    }
  }

  private async generateSalesReport(options: ReportOptions): Promise<any> {
    const dateRange = options.dateRange || this.getDefaultDateRange(options.period);
    
    const salesData = await this.prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, category: { select: { name: true } } }
            }
          }
        }
      }
    });

    return {
      totalSales: salesData.length,
      totalRevenue: salesData.reduce((sum, order) => sum + Number(order.totalAmount), 0),
      averageOrderValue: salesData.length > 0 ? 
        salesData.reduce((sum, order) => sum + Number(order.totalAmount), 0) / salesData.length : 0,
      topProducts: this.getTopProductsFromOrders(salesData),
      salesByCategory: this.getSalesByCategory(salesData)
    };
  }

  private async generateUsersReport(options: ReportOptions): Promise<any> {
    const dateRange = options.dateRange || this.getDefaultDateRange(options.period);
    
    const userData = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
      },
      include: {
        orders: {
          where: { status: 'DELIVERED' },
          select: { totalAmount: true }
        }
      }
    });

    return {
      totalUsers: userData.length,
      newUsers: userData.length,
      activeUsers: userData.filter(u => u.orders.length > 0).length,
      totalCustomerValue: userData.reduce((sum, user) => 
        sum + user.orders.reduce((orderSum, order) => orderSum + Number(order.totalAmount), 0), 0
      ),
      averageCustomerValue: userData.length > 0 ? 
        userData.reduce((sum, user) => 
          sum + user.orders.reduce((orderSum, order) => orderSum + Number(order.totalAmount), 0), 0
        ) / userData.length : 0
    };
  }

  private async generateProductsReport(options: ReportOptions): Promise<any> {
    const dateRange = options.dateRange || this.getDefaultDateRange(options.period);
    
    const productData = await this.prisma.product.findMany({
      where: {
        createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
      },
      include: {
        orderItems: {
          where: {
            order: { status: 'DELIVERED' }
          }
        }
      }
    });

    return {
      totalProducts: productData.length,
      activeProducts: productData.filter(p => p.orderItems.length > 0).length,
      topPerformers: productData
        .map(p => ({
          id: p.id,
          name: p.name,
          sales: p.orderItems.length,
          revenue: p.orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    };
  }

  private async generateSellersReport(options: ReportOptions): Promise<any> {
    const dateRange = options.dateRange || this.getDefaultDateRange(options.period);
    
    const sellerData = await this.prisma.seller.findMany({
      where: {
        joinedAt: { gte: dateRange.startDate, lte: dateRange.endDate }
      },
      include: {
        products: {
          include: {
            orderItems: {
              where: {
                order: { status: 'DELIVERED' }
              }
            }
          }
        }
      }
    });

    return {
      totalSellers: sellerData.length,
      activeSellers: sellerData.filter(s => 
        s.products.some(p => p.orderItems.length > 0)
      ).length,
      topSellers: sellerData
        .map(s => ({
          id: s.id,
          storeName: s.businessName,
          products: s.products.length,
          sales: s.products.reduce((sum, p) => sum + p.orderItems.length, 0),
          revenue: s.products.reduce((sum, p) => 
            sum + p.orderItems.reduce((itemSum, item) => 
              itemSum + Number(item.price) * item.quantity, 0
            ), 0
          )
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    };
  }

  private async generateTrafficReport(options: ReportOptions): Promise<any> {
    const dateRange = options.dateRange || this.getDefaultDateRange(options.period);
    
    const trafficData = await this.prisma.analyticsEvent.findMany({
      where: {
        type: { in: ['PAGE_VIEW', 'SESSION_START', 'PRODUCT_VIEW'] },
        createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
      }
    });

    const pageViews = trafficData.filter(e => e.type === 'PAGE_VIEW').length;
    const sessions = trafficData.filter(e => e.type === 'SESSION_START').length;
    const productViews = trafficData.filter(e => e.type === 'PRODUCT_VIEW').length;

    return {
      totalPageViews: pageViews,
      totalSessions: sessions,
      totalProductViews: productViews,
      avgPageViewsPerSession: sessions > 0 ? pageViews / sessions : 0,
      topPages: this.getTopPagesFromEvents(trafficData)
    };
  }

  private async generateFinancialReport(options: ReportOptions): Promise<any> {
    const dateRange = options.dateRange || this.getDefaultDateRange(options.period);
    
    const [orders, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: 'DELIVERED',
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
        }
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'PAID',
          createdAt: { gte: dateRange.startDate, lte: dateRange.endDate }
        }
      })
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOrders = orders.length;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      revenueByPaymentMethod: this.getRevenueByPaymentMethod(payments),
      dailyRevenue: this.getDailyRevenue(payments, dateRange)
    };
  }

  // Helper methods for report generation
  private getDefaultDateRange(period: string): AnalyticsDateRange {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  private getTopProductsFromOrders(orders: any[]): any[] {
    const productMap = new Map();
    
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        const productId = item.productId;
        if (productMap.has(productId)) {
          const existing = productMap.get(productId);
          existing.quantity += item.quantity;
          existing.revenue += Number(item.price) * item.quantity;
        } else {
          productMap.set(productId, {
            id: productId,
            name: item.product.name,
            quantity: item.quantity,
            revenue: Number(item.price) * item.quantity
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private getSalesByCategory(orders: any[]): any[] {
    const categoryMap = new Map();
    
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        const categoryName = item.product.category?.name || 'Uncategorized';
        if (categoryMap.has(categoryName)) {
          const existing = categoryMap.get(categoryName);
          existing.sales += item.quantity;
          existing.revenue += Number(item.price) * item.quantity;
        } else {
          categoryMap.set(categoryName, {
            category: categoryName,
            sales: item.quantity,
            revenue: Number(item.price) * item.quantity
          });
        }
      });
    });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.revenue - a.revenue);
  }

  private getTopPagesFromEvents(events: any[]): any[] {
    const pageMap = new Map();
    
    events
      .filter(e => e.type === 'PAGE_VIEW' && e.data?.page)
      .forEach(event => {
        const page = event.data.page;
        pageMap.set(page, (pageMap.get(page) || 0) + 1);
      });

    return Array.from(pageMap.entries())
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private getRevenueByPaymentMethod(payments: any[]): any[] {
    const methodMap = new Map();
    
    payments.forEach(payment => {
      const method = payment.method || 'Unknown';
      if (methodMap.has(method)) {
        methodMap.set(method, methodMap.get(method) + Number(payment.amount));
      } else {
        methodMap.set(method, Number(payment.amount));
      }
    });

    return Array.from(methodMap.entries())
      .map(([method, revenue]) => ({ method, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private getDailyRevenue(payments: any[], dateRange: AnalyticsDateRange): any[] {
    const dailyMap = new Map();
    
    payments.forEach(payment => {
      const day = payment.createdAt.toISOString().split('T')[0];
      if (dailyMap.has(day)) {
        dailyMap.set(day, dailyMap.get(day) + Number(payment.amount));
      } else {
        dailyMap.set(day, Number(payment.amount));
      }
    });

    // Fill in missing days with 0 revenue
    const result = [];
    const currentDate = new Date(dateRange.startDate);
    while (currentDate <= dateRange.endDate) {
      const day = currentDate.toISOString().split('T')[0];
      result.push({
        date: day,
        revenue: dailyMap.get(day) || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }
}

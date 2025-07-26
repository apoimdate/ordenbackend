import { PrismaClient, Prisma, PlatformAnalytics } from '@prisma/client';
import { BaseRepository } from './base.repository';

interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  totalSellers: number;
  newUsers: number;
  activeUsers: number;
  activeSellers: number;
  newProducts: number;
  avgOrderValue: number;
  conversionRate: number;
  period: string;
}

export class AnalyticsRepository extends BaseRepository<PlatformAnalytics, Prisma.PlatformAnalyticsCreateInput, Prisma.PlatformAnalyticsUpdateInput> {
  constructor(prisma: PrismaClient, redis: any, logger: any) {
    super(prisma, redis, logger, 'platformAnalytics');
  }

  async getAnalyticsSummary(period: string): Promise<AnalyticsSummary> {
    try {
      const dateRange = this.getDateRangeForPeriod(period);
      
      // Get platform analytics for the period
      const platformData = await this.prisma.platformAnalytics.findMany({
        where: {
          date: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          }
        },
        orderBy: { date: 'desc' }
      });

      // Calculate totals
      const totalRevenue = platformData.reduce((sum, data) => sum + Number(data.totalRevenue), 0);
      const totalOrders = platformData.reduce((sum, data) => sum + data.totalOrders, 0);
      const newUsers = platformData.reduce((sum, data) => sum + data.newUsers, 0);
      const activeUsers = Math.max(...platformData.map(d => d.activeUsers), 0);
      const activeSellers = Math.max(...platformData.map(d => d.activeSellers), 0);
      const newProducts = platformData.reduce((sum, data) => sum + data.newProducts, 0);

      // Get total counts
      const [totalUsersCount, totalSellersCount] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.seller.count()
      ]);

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const conversionRate = activeUsers > 0 ? (totalOrders / activeUsers) * 100 : 0;

      return {
        totalRevenue,
        totalOrders,
        totalUsers: totalUsersCount,
        totalSellers: totalSellersCount,
        newUsers,
        activeUsers,
        activeSellers,
        newProducts,
        avgOrderValue,
        conversionRate,
        period
      };
    } catch (error) {
      this.logger.error({ error, period }, 'Failed to get analytics summary');
      return {
        totalRevenue: 0,
        totalOrders: 0,
        totalUsers: 0,
        totalSellers: 0,
        newUsers: 0,
        activeUsers: 0,
        activeSellers: 0,
        newProducts: 0,
        avgOrderValue: 0,
        conversionRate: 0,
        period
      };
    }
  }

  async createDailySnapshot(date: Date): Promise<PlatformAnalytics | null> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Calculate daily metrics
      const [
        dailyRevenue,
        dailyOrders,
        newUsersCount,
        activeUsersCount,
        activeSellersCount,
        newProductsCount
      ] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            status: 'PAID',
            createdAt: { gte: startOfDay, lte: endOfDay }
          },
          _sum: { amount: true }
        }),
        this.prisma.order.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        this.prisma.user.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        this.prisma.analyticsEvent.aggregate({
          where: {
            type: 'SESSION_START',
            createdAt: { gte: startOfDay, lte: endOfDay }
          },
          _count: { userId: true }
        }),
        this.prisma.seller.count({
          where: {
            joinedAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        this.prisma.product.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay }
          }
        })
      ]);

      // Create platform analytics record
      const analyticsData = await this.prisma.platformAnalytics.upsert({
        where: { date: startOfDay },
        create: {
          date: startOfDay,
          totalRevenue: dailyRevenue._sum.amount || 0,
          totalOrders: dailyOrders,
          newUsers: newUsersCount,
          activeUsers: activeUsersCount._count.userId || 0,
          activeSellers: activeSellersCount,
          newProducts: newProductsCount
        },
        update: {
          totalRevenue: dailyRevenue._sum.amount || 0,
          totalOrders: dailyOrders,
          newUsers: newUsersCount,
          activeUsers: activeUsersCount._count.userId || 0,
          activeSellers: activeSellersCount,
          newProducts: newProductsCount
        }
      });

      this.logger.info({ date: startOfDay, revenue: dailyRevenue._sum.amount }, 'Daily analytics snapshot created');
      return analyticsData;
    } catch (error) {
      this.logger.error({ error, date }, 'Failed to create daily analytics snapshot');
      return null;
    }
  }

  async getRevenueChart(period: string): Promise<Array<{ date: string; revenue: number; orders: number }>> {
    try {
      const dateRange = this.getDateRangeForPeriod(period);
      
      const data = await this.prisma.platformAnalytics.findMany({
        where: {
          date: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          }
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          totalRevenue: true,
          totalOrders: true
        }
      });

      return data.map(item => ({
        date: item.date.toISOString().split('T')[0],
        revenue: Number(item.totalRevenue),
        orders: item.totalOrders
      }));
    } catch (error) {
      this.logger.error({ error, period }, 'Failed to get revenue chart data');
      return [];
    }
  }

  private getDateRangeForPeriod(period: string): AnalyticsPeriod {
    const now = new Date();
    const startDate = new Date();
    
    switch (period.toLowerCase()) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() - 1);
        now.setHours(23, 59, 59, 999);
        break;
      case 'week':
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'quarter':
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
      case '365d':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7); // Default to 7 days
    }

    return { startDate, endDate: now };
  }
}

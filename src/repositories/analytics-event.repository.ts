import { PrismaClient, Prisma, AnalyticsEvent } from '@prisma/client';
import { BaseRepository } from './base.repository';

interface EventData {
  type: string;
  userId?: string;
  productId?: string;
  sellerId?: string;
  data: any;
}

interface EventFilters {
  type?: string;
  userId?: string;
  productId?: string;
  sellerId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface EventAggregation {
  type: string;
  count: number;
  uniqueUsers?: number;
  uniqueProducts?: number;
  uniqueSellers?: number;
}

export class AnalyticsEventRepository extends BaseRepository<AnalyticsEvent, Prisma.AnalyticsEventCreateInput, Prisma.AnalyticsEventUpdateInput> {
  constructor(prisma: PrismaClient, redis: any, logger: any) {
    super(prisma, redis, logger, 'analyticsEvent');
  }

  async trackEvent(eventData: EventData): Promise<AnalyticsEvent | null> {
    try {
      const event = await this.prisma.analyticsEvent.create({
        data: {
          type: eventData.type,
          userId: eventData.userId,
          productId: eventData.productId,
          sellerId: eventData.sellerId,
          data: eventData.data
        }
      });

      // Cache frequently accessed events
      if (['PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'PURCHASE'].includes(eventData.type)) {
        const cacheKey = `analytics:event:${event.id}`;
        await this.redis.setex(cacheKey, 3600, JSON.stringify(event)); // Cache for 1 hour
      }

      this.logger.debug({ 
        eventId: event.id, 
        type: eventData.type, 
        userId: eventData.userId 
      }, 'Analytics event tracked');

      return event;
    } catch (error) {
      this.logger.error({ error, eventData }, 'Failed to track analytics event');
      return null;
    }
  }

  async getEventsByFilter(filters: EventFilters, limit: number = 100, offset: number = 0): Promise<AnalyticsEvent[]> {
    try {
      const where: Prisma.AnalyticsEventWhereInput = {};

      if (filters.type) where.type = filters.type;
      if (filters.userId) where.userId = filters.userId;
      if (filters.productId) where.productId = filters.productId;
      if (filters.sellerId) where.sellerId = filters.sellerId;

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const events = await this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return events;
    } catch (error) {
      this.logger.error({ error, filters }, 'Failed to get events by filter');
      return [];
    }
  }

  async getEventAggregation(filters: EventFilters): Promise<EventAggregation[]> {
    try {
      const where: Prisma.AnalyticsEventWhereInput = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.productId) where.productId = filters.productId;
      if (filters.sellerId) where.sellerId = filters.sellerId;

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      // Group by event type and count
      const aggregation = await this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where,
        _count: {
          _all: true,
          userId: true,
          productId: true,
          sellerId: true
        }
      });

      return aggregation.map(item => ({
        type: item.type,
        count: item._count._all || 0,
        uniqueUsers: item._count.userId || 0,
        uniqueProducts: item._count.productId || 0,
        uniqueSellers: item._count.sellerId || 0
      }));
    } catch (error) {
      this.logger.error({ error, filters }, 'Failed to get event aggregation');
      return [];
    }
  }

  async getUserActivity(userId: string, days: number = 30): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          userId,
          createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'desc' },
        take: 1000 // Limit to prevent excessive data
      });

      // Group events by day
      const activityByDay = events.reduce((acc: any, event) => {
        const day = event.createdAt.toISOString().split('T')[0];
        
        if (!acc[day]) {
          acc[day] = {
            date: day,
            events: [],
            pageViews: 0,
            productViews: 0,
            cartAdditions: 0,
            purchases: 0
          };
        }

        acc[day].events.push(event);
        
        switch (event.type) {
          case 'PAGE_VIEW':
            acc[day].pageViews++;
            break;
          case 'PRODUCT_VIEW':
            acc[day].productViews++;
            break;
          case 'ADD_TO_CART':
            acc[day].cartAdditions++;
            break;
          case 'PURCHASE':
            acc[day].purchases++;
            break;
        }

        return acc;
      }, {});

      return Object.values(activityByDay);
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user activity');
      return [];
    }
  }

  async getProductMetrics(productId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          productId,
          createdAt: { gte: startDate }
        }
      });

      const metrics = {
        views: events.filter(e => e.type === 'PRODUCT_VIEW').length,
        cartAdditions: events.filter(e => e.type === 'ADD_TO_CART').length,
        wishlistAdditions: events.filter(e => e.type === 'ADD_TO_WISHLIST').length,
        purchases: events.filter(e => e.type === 'PURCHASE').length,
        uniqueViewers: new Set(
          events
            .filter(e => e.type === 'PRODUCT_VIEW' && e.userId)
            .map(e => e.userId)
        ).size,
        conversionRate: 0
      };

      // Calculate conversion rate
      if (metrics.views > 0) {
        metrics.conversionRate = (metrics.purchases / metrics.views) * 100;
      }

      return metrics;
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to get product metrics');
      return {
        views: 0,
        cartAdditions: 0,
        wishlistAdditions: 0,
        purchases: 0,
        uniqueViewers: 0,
        conversionRate: 0
      };
    }
  }

  async getSellerMetrics(sellerId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          sellerId,
          createdAt: { gte: startDate }
        }
      });

      const metrics = {
        productViews: events.filter(e => e.type === 'PRODUCT_VIEW').length,
        storeViews: events.filter(e => e.type === 'STORE_VIEW').length,
        cartAdditions: events.filter(e => e.type === 'ADD_TO_CART').length,
        purchases: events.filter(e => e.type === 'PURCHASE').length,
        uniqueVisitors: new Set(
          events
            .filter(e => e.userId)
            .map(e => e.userId)
        ).size,
        conversionRate: 0
      };

      // Calculate conversion rate
      const totalViews = metrics.productViews + metrics.storeViews;
      if (totalViews > 0) {
        metrics.conversionRate = (metrics.purchases / totalViews) * 100;
      }

      return metrics;
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller metrics');
      return {
        productViews: 0,
        storeViews: 0,
        cartAdditions: 0,
        purchases: 0,
        uniqueVisitors: 0,
        conversionRate: 0
      };
    }
  }

  async getTopEvents(type?: string, limit: number = 10): Promise<any[]> {
    try {
      const where: Prisma.AnalyticsEventWhereInput = {};
      if (type) where.type = type;

      // Get most frequent events in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      where.createdAt = { gte: sevenDaysAgo };

      const events = await this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit
      });

      return events.map(event => ({
        type: event.type,
        count: event._count.id || 0
      }));
    } catch (error) {
      this.logger.error({ error, type }, 'Failed to get top events');
      return [];
    }
  }

  async cleanupOldEvents(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.analyticsEvent.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      this.logger.info({ 
        deletedCount: result.count,
        cutoffDate 
      }, 'Old analytics events cleaned up');

      return result.count;
    } catch (error) {
      this.logger.error({ error, daysToKeep }, 'Failed to cleanup old events');
      return 0;
    }
  }
}

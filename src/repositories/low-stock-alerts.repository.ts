import { BaseRepository } from './base.repository';
import { low_stock_alerts, Prisma } from '@prisma/client';

export class LowStockAlertsRepository extends BaseRepository<low_stock_alerts, Prisma.low_stock_alertsCreateInput, Prisma.low_stock_alertsUpdateInput> {
  constructor(prisma: any, redis: any, logger: any) {
    super(prisma, redis, logger, 'low_stock_alerts');
  }

  // PRODUCTION: Low stock alert specific methods

  async findByProductId(productId: string): Promise<low_stock_alerts[]> {
    return this.findMany({
      where: { product_id: productId },
      orderBy: { created_at: 'desc' }
    });
  }

  async findAlertsByDateRange(startDate: Date, endDate: Date): Promise<low_stock_alerts[]> {
    return this.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async createAlert(data: {
    product_id: string;
  }): Promise<low_stock_alerts> {
    return this.create({
      id: require('nanoid').nanoid(),
      product: { connect: { id: data.product_id } },
      created_at: new Date()
    });
  }

  async getAlertStats(): Promise<{
    totalAlerts: number;
    alertsByProduct: Record<string, number>;
    recentAlerts: number; // alerts from last 7 days
  }> {
    const allAlerts = await this.findMany({});
    
    // Count alerts by product
    const alertsByProduct: Record<string, number> = {};
    allAlerts.forEach(alert => {
      alertsByProduct[alert.product_id] = (alertsByProduct[alert.product_id] || 0) + 1;
    });

    // Count recent alerts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAlerts = allAlerts.filter(alert => alert.created_at >= sevenDaysAgo).length;

    return {
      totalAlerts: allAlerts.length,
      alertsByProduct,
      recentAlerts
    };
  }

  async getRecentAlerts(limit = 20): Promise<low_stock_alerts[]> {
    return this.findMany({
      orderBy: { created_at: 'desc' },
      take: limit
    });
  }

  async deleteOldAlerts(daysToKeep = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.deleteMany({
      created_at: {
        lt: cutoffDate
      }
    });

    return { deleted: result.count };
  }

  async getAlertTrends(days = 30): Promise<{
    dailyAlerts: Array<{ date: string; count: number }>;
    totalNewAlerts: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const alerts = await this.findAlertsByDateRange(startDate, new Date());

    const dailyAlerts: Record<string, number> = {};

    alerts.forEach(alert => {
      const dateKey = alert.created_at.toISOString().split('T')[0];
      dailyAlerts[dateKey] = (dailyAlerts[dateKey] || 0) + 1;
    });

    const dailyAlertsArray = Object.entries(dailyAlerts).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      dailyAlerts: dailyAlertsArray,
      totalNewAlerts: alerts.length
    };
  }

  async findDuplicateAlerts(): Promise<Array<{
    product_id: string;
    count: number;
    alert_ids: string[];
  }>> {
    const alerts = await this.findMany({});
    
    const productAlerts: Record<string, string[]> = {};
    
    alerts.forEach(alert => {
      if (!productAlerts[alert.product_id]) {
        productAlerts[alert.product_id] = [];
      }
      productAlerts[alert.product_id].push(alert.id);
    });

    return Object.entries(productAlerts)
      .filter(([_, alertIds]) => alertIds.length > 1)
      .map(([product_id, alert_ids]) => ({
        product_id,
        count: alert_ids.length,
        alert_ids
      }))
      .sort((a, b) => b.count - a.count);
  }

  async bulkDeleteAlerts(alertIds: string[]): Promise<{ count: number }> {
    return this.deleteMany({
      id: { in: alertIds }
    });
  }

  async getAlertsForProducts(productIds: string[]): Promise<low_stock_alerts[]> {
    return this.findMany({
      where: {
        product_id: { in: productIds }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async cleanupDuplicateAlerts(): Promise<{ cleaned: number }> {
    const duplicates = await this.findDuplicateAlerts();
    let totalCleaned = 0;

    for (const duplicate of duplicates) {
      // Keep the most recent alert, delete the rest
      const alertsToDelete = duplicate.alert_ids.slice(1); // Keep first (most recent due to desc order)
      const result = await this.bulkDeleteAlerts(alertsToDelete);
      totalCleaned += result.count;
    }

    return { cleaned: totalCleaned };
  }

  async hasActiveAlert(productId: string): Promise<boolean> {
    const alert = await this.findFirst({
      where: { product_id: productId }
    });
    return !!alert;
  }

  async getMostAlertedProducts(limit = 10): Promise<Array<{
    product_id: string;
    alertCount: number;
    latestAlert: Date;
  }>> {
    const alerts = await this.findMany({});
    
    const productAlertData: Record<string, { count: number; latestAlert: Date }> = {};
    
    alerts.forEach(alert => {
      if (!productAlertData[alert.product_id]) {
        productAlertData[alert.product_id] = { count: 0, latestAlert: alert.created_at };
      }
      productAlertData[alert.product_id].count += 1;
      
      if (alert.created_at > productAlertData[alert.product_id].latestAlert) {
        productAlertData[alert.product_id].latestAlert = alert.created_at;
      }
    });

    return Object.entries(productAlertData)
      .map(([product_id, data]) => ({
        product_id,
        alertCount: data.count,
        latestAlert: data.latestAlert
      }))
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, limit);
  }
}
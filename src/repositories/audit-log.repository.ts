import { BaseRepository } from './base.repository';
import { AuditLog, Prisma } from '@prisma/client';

export class AuditLogRepository extends BaseRepository<AuditLog, Prisma.AuditLogCreateInput, Prisma.AuditLogUpdateInput> {
  constructor(prisma: any, redis: any, logger: any) {
    super(prisma, redis, logger, 'auditLog');
  }

  // PRODUCTION: Audit log specific methods

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByAction(action: string): Promise<AuditLog[]> {
    return this.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByEntity(entity: string): Promise<AuditLog[]> {
    return this.findMany({
      where: { entity },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByEntityId(entityId: string): Promise<AuditLog[]> {
    return this.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return this.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createAuditLog(data: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: any;
    after?: any;
  }): Promise<AuditLog> {
    return this.create({
      id: require('nanoid').nanoid(),
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      before: data.before || null,
      after: data.after || null,
      createdAt: new Date()
    });
  }

  async getActionStats(): Promise<Record<string, number>> {
    const logs = await this.findMany({});
    const actionCount: Record<string, number> = {};

    logs.forEach(log => {
      actionCount[log.action] = (actionCount[log.action] || 0) + 1;
    });

    return actionCount;
  }

  async getEntityStats(): Promise<Record<string, number>> {
    const logs = await this.findMany({});
    const entityCount: Record<string, number> = {};

    logs.forEach(log => {
      entityCount[log.entity] = (entityCount[log.entity] || 0) + 1;
    });

    return entityCount;
  }

  async getUserActivitySummary(userId: string, days = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    entitiesModified: number;
    lastActivity: Date | null;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate
        }
      }
    });

    const actionsByType: Record<string, number> = {};
    const uniqueEntities = new Set<string>();
    let lastActivity: Date | null = null;

    logs.forEach(log => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      
      uniqueEntities.add(`${log.entity}:${log.entityId}`);

      if (!lastActivity || log.createdAt > lastActivity) {
        lastActivity = log.createdAt;
      }
    });

    return {
      totalActions: logs.length,
      actionsByType,
      entitiesModified: uniqueEntities.size,
      lastActivity
    };
  }

  async getActivityTrends(days = 30): Promise<{
    dailyActivity: Array<{ date: string; count: number }>;
    topUsers: Array<{ userId: string; actionCount: number }>;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });

    // Daily activity
    const dailyActivity: Record<string, number> = {};
    const userActivity: Record<string, number> = {};
    const actionActivity: Record<string, number> = {};

    logs.forEach(log => {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      dailyActivity[dateKey] = (dailyActivity[dateKey] || 0) + 1;
      
      userActivity[log.userId] = (userActivity[log.userId] || 0) + 1;
      actionActivity[log.action] = (actionActivity[log.action] || 0) + 1;
    });

    const dailyActivityArray = Object.entries(dailyActivity).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => a.date.localeCompare(b.date));

    const topUsers = Object.entries(userActivity)
      .map(([userId, actionCount]) => ({ userId, actionCount }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    const topActions = Object.entries(actionActivity)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      dailyActivity: dailyActivityArray,
      topUsers,
      topActions
    };
  }

  async findSuspiciousActivity(options: {
    rapidActions?: number; // Number of rapid actions threshold
    timeWindowMinutes?: number; // Time window for rapid actions
  } = {}): Promise<AuditLog[]> {
    const {
      rapidActions = 50,
      timeWindowMinutes = 10
    } = options;

    const timeWindowStart = new Date();
    timeWindowStart.setMinutes(timeWindowStart.getMinutes() - timeWindowMinutes);

    // Find users with rapid actions
    const recentLogs = await this.findMany({
      where: {
        createdAt: {
          gte: timeWindowStart
        }
      }
    });

    const userActionCounts: Record<string, number> = {};
    recentLogs.forEach(log => {
      userActionCounts[log.userId] = (userActionCounts[log.userId] || 0) + 1;
    });

    const suspiciousUserIds = Object.entries(userActionCounts)
      .filter(([_, count]) => count >= rapidActions)
      .map(([userId]) => userId);

    if (suspiciousUserIds.length === 0) {
      return [];
    }

    return this.findMany({
      where: {
        userId: { in: suspiciousUserIds },
        createdAt: { gte: timeWindowStart }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getEntityHistory(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.findMany({
      where: {
        entity,
        entityId
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async cleanupOldLogs(daysToKeep = 365): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.deleteMany({
      createdAt: {
        lt: cutoffDate
      }
    });

    return { deleted: result.count };
  }

  async exportAuditLogs(criteria: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: string;
    entity?: string;
  }): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = {};

    if (criteria.startDate || criteria.endDate) {
      where.createdAt = {};
      if (criteria.startDate) where.createdAt.gte = criteria.startDate;
      if (criteria.endDate) where.createdAt.lte = criteria.endDate;
    }

    if (criteria.userId) where.userId = criteria.userId;
    if (criteria.action) where.action = criteria.action;
    if (criteria.entity) where.entity = criteria.entity;

    return this.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }
}
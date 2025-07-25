import { FastifyInstance } from 'fastify';
import { Prisma, PrismaClient, Notification, NotificationType } from '@prisma/client';
import { CrudService } from './crud.service';
import { ApiError } from '../utils/errors';
import { CreateNotificationData, NotificationWithDetails } from '../types';

export class NotificationService extends CrudService<
  Notification,
  Prisma.NotificationCreateInput,
  Prisma.NotificationUpdateInput
> {
  public modelName: keyof PrismaClient = 'notification';

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // In-App Notifications

  async createNotification(data: CreateNotificationData): Promise<NotificationWithDetails> {
    try {
      // Check if user exists
      if (data.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: data.userId },
        });

        if (!user) {
          throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
        }
      }

      // Create notification
      const notification = await this.prisma.notification.create({
        data: {
          type: data.type as any, // Cast to handle enum type
          title: data.title,
          message: data.message,
          userId: data.userId,
          data: data.data || {},
          isRead: false,
        } as any,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // If not scheduled, process immediately
      if (!data.scheduledFor || data.scheduledFor <= new Date()) {
        await this.processNotification(notification);
      }

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'notification_created',
          userId: data.userId,
          data: {
            notificationId: notification.id,
            notificationType: notification.type,
            label: data.type,
          },
        },
      });

      this.logger.info(
        {
          notificationId: notification.id,
          type: data.type,
          userId: data.userId,
        },
        'Notification created successfully'
      );

      return {
        ...notification,
        priority: 'MEDIUM' // Add required priority field
      } as any;
    } catch (error) {
      this.logger.error({ error, data }, 'Error creating notification');
      throw new ApiError('Failed to create notification', 500, 'NOTIFICATION_CREATION_FAILED');
    }
  }

  async processNotification(notification: Notification): Promise<void> {
    // This is a placeholder for the actual notification processing logic
    this.logger.info(`Processing notification ${notification.id}`);
  }

  async getUserNotifications(
    userId: string,
    options: {
      page: number;
      limit: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      category?: string;
    }
  ): Promise<any> {
    const { page, limit, unreadOnly, type } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly && { isRead: false }),
      ...(type && { type }),
    };

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<any> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return {
        success: false,
        error: {
          message: 'Notification not found',
          statusCode: 404,
          code: 'NOTIFICATION_NOT_FOUND',
        },
      };
    }

    if (notification.isRead) {
      return { success: true };
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { success: true };
  }

  async markAllNotificationsAsRead(userId: string): Promise<any> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { success: true };
  }

  async deleteNotification(notificationId: string, userId: string): Promise<any> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return {
        success: false,
        error: {
          message: 'Notification not found',
          statusCode: 404,
          code: 'NOTIFICATION_NOT_FOUND',
        },
      };
    }

    await this.prisma.notification.delete({ where: { id: notificationId } });

    return { success: true };
  }

  async getUserPreferences(userId: string): Promise<any> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    if (!preferences || preferences.length === 0) {
      // Create default preferences if none exist
      const defaultPreferences = await this.prisma.notificationPreference.create({
        data: { 
          userId,
          channel: 'ORDER_UPDATE',
        },
      });
      return { success: true, data: [defaultPreferences] };
    }

    return { success: true, data: preferences };
  }

  async updateUserPreferences(userId: string, data: Prisma.NotificationPreferenceUpdateInput): Promise<any> {
    const preferences = await this.prisma.notificationPreference.updateMany({
      where: { userId },
      data,
    });

    return { success: true, data: preferences };
  }

  async broadcastNotification(data: any): Promise<any> {
    // This is a placeholder for the actual broadcast logic
    this.logger.info({ data }, 'Broadcasting notification');
    return { success: true, data: { message: 'Broadcast queued' } };
  }

  async createTemplate(data: any): Promise<any> {
    const template = await this.prisma.emailTemplate.create({
      data,
    });
    return { success: true, data: template };
  }

  async getTemplate(templateId: string): Promise<any> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return {
        success: false,
        error: {
          message: 'Template not found',
          statusCode: 404,
          code: 'TEMPLATE_NOT_FOUND',
        },
      };
    }

    return { success: true, data: template };
  }

  async getNotificationAnalytics(options: { startDate: Date; endDate: Date }): Promise<any> {
    const { startDate, endDate } = options;

    const stats = await this.prisma.notification.groupBy({
      by: ['type'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        _all: true,
      },
    });

    return { success: true, data: stats };
  }
}
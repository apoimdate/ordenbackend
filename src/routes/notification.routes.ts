import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notification.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { NotificationType } from '../utils/constants';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const notificationService = new NotificationService(fastify);

  // Schemas
  const updatePreferencesSchema = z.object({
    body: z.object({
      emailNotifications: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      inAppNotifications: z.boolean().optional(),
      marketingEmails: z.boolean().optional(),
      orderUpdates: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      productUpdates: z.boolean().optional(),
      promotions: z.boolean().optional(),
      reminders: z.boolean().optional(),
      frequency: z.enum(['IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY']).optional()
    })
  });

  const createTemplateSchema = z.object({
    body: z.object({
      name: z.string().min(1).max(100),
      type: z.nativeEnum(NotificationType),
      channel: z.enum(['EMAIL', 'SMS', 'PUSH', 'IN_APP']),
      subject: z.string().max(200).optional(),
      content: z.string().min(1).max(5000),
      variables: z.array(z.string()).optional(),
      language: z.string().length(2).optional().default('en')
    })
  });

  const sendNotificationSchema = z.object({
    body: z.object({
      type: z.nativeEnum(NotificationType),
      title: z.string().min(1).max(200),
      message: z.string().min(1).max(1000),
      recipients: z.array(z.string()).min(1),
      templateId: z.string().uuid().optional(),
      data: z.record(z.any()).optional(),
      scheduledFor: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined)
    })
  });

  const broadcastSchema = z.object({
    body: z.object({
      type: z.nativeEnum(NotificationType),
      title: z.string().min(1).max(200),
      message: z.string().min(1).max(1000),
      channels: z.array(z.enum(['EMAIL', 'SMS', 'PUSH', 'IN_APP'])).min(1),
      templateId: z.string().uuid().optional(),
      data: z.record(z.any()).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
      category: z.string().max(50).optional(),
      userSegment: z.object({
        roles: z.array(z.string()).optional(),
        countries: z.array(z.string()).optional(),
        registeredAfter: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
        hasOrders: z.boolean().optional()
      }).optional(),
      maxRecipients: z.number().int().positive().max(50000).optional()
    })
  });

  // User Notification Routes

  // Get user notifications
  fastify.get(
    '/',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const { 
        page = '1', 
        limit = '20',
        unreadOnly = 'false',
        type,
        category
      } = (request.query as any) as any;

      const result = await notificationService.getUserNotifications(user.id, {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: unreadOnly === 'true',
        type,
        category
      });
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send(result.data);
    }
  );

  // Mark notification as read
  fastify.put(
    '/:notificationId/read',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const { notificationId } = (request.params as any) as { notificationId: string };
      
      const result = await notificationService.markNotificationAsRead(notificationId, user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send({
        message: 'Notification marked as read'
      });
    }
  );

  // Mark all notifications as read
  fastify.put(
    '/mark-all-read',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      
      const result = await notificationService.markAllNotificationsAsRead(user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send({
        message: 'All notifications marked as read'
      });
    }
  );

  // Delete notification
  fastify.delete(
    '/:notificationId',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const { notificationId } = (request.params as any) as { notificationId: string };
      
      const result = await notificationService.deleteNotification(notificationId, user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send({
        message: 'Notification deleted successfully'
      });
    }
  );

  // Get notification count summary
  fastify.get(
    '/summary',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;

      const [total, unread] = await Promise.all([
        fastify.prisma.notification.count({
          where: {
            userId: user.id,
          }
        }),
        fastify.prisma.notification.count({
          where: {
            userId: user.id,
            isRead: false,
          }
        })
      ]);

      return reply.send({
        total,
        unread,
        read: total - unread
      });
    }
  );

  // Notification Preferences Routes

  // Get user notification preferences
  fastify.get(
    '/preferences',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      
      const result = await notificationService.getUserPreferences(user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send(result.data);
    }
  );

  // Update user notification preferences
  fastify.put(
    '/preferences',
    {
      preHandler: [
        authenticate,
        authorize(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']),
        validateRequest(updatePreferencesSchema)
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      
      const result = await notificationService.updateUserPreferences(user.id, (request.body as any));
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send({
        message: 'Notification preferences updated successfully',
        preferences: result.data
      });
    }
  );

  // Admin Routes

  // Send notification to specific users (Admin only)
  fastify.post(
    '/admin/send',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN']),
        validateRequest(sendNotificationSchema)
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const { recipients, ...notificationData } = (request.body as any);

      const results = [];
      
      for (const recipient of recipients) {
        // Determine if recipient is user ID or email/phone
        let userId = recipient;
        
        if (!recipient.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // Look up user by email or phone
          const foundUser = await fastify.prisma.user.findFirst({
            where: {
              OR: [
                { email: recipient },
                { phoneNumber: recipient }
              ]
            },
            select: { id: true }
          });
          
          if (!foundUser) {
            results.push({
              recipient,
              success: false,
              error: 'User not found'
            });
            continue;
          }
          
          userId = foundUser.id;
        }

        const result = await notificationService.createNotification({
          ...notificationData,
          userId,
          createdBy: user.id
        });

        results.push({
          recipient,
          userId,
          success: !!result.id,
        });
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      return reply.send({
        message: `Sent ${successCount} notifications, ${errorCount} failed`,
        results,
        summary: {
          total: recipients.length,
          success: successCount,
          errors: errorCount
        }
      });
    }
  );

  // Broadcast notification (Admin only)
  fastify.post(
    '/admin/broadcast',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN']),
        validateRequest(broadcastSchema)
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      
      const result = await notificationService.broadcastNotification({
        ...(request.body as any),
        createdBy: user.id
      });
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send({
        message: 'Broadcast notification sent successfully',
        ...result.data
      });
    }
  );

  // Get all notifications for admin
  fastify.get(
    '/admin/notifications',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { 
        page = '1', 
        limit = '20',
        type,
        priority,
        userId,
        dateFrom,
        dateTo
      } = (request.query as any) as any;

      const where: any = {};
      
      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (userId) where.userId = userId;
      
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [notifications, total] = await Promise.all([
        fastify.prisma.notification.findMany({
          where,
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit)
        }),
        fastify.prisma.notification.count({ where })
      ]);

      return reply.send({
        data: notifications,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    }
  );

  // Template Management Routes (Admin only)

  // Get notification templates
  fastify.get(
    '/admin/templates',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        page = '1',
        limit = '20',
        type,
        channel,
        language = 'en'
      } = (request.query as any) as any;

      const where: any = {};
      if (type) where.type = type;
      if (channel) where.channel = channel;
      if (language) where.language = language;

      const skip = (Number(page) - 1) * Number(limit);

      const [templates, total] = await Promise.all([
        fastify.prisma.emailTemplate.findMany({
          where,
          select: {
            id: true,
            name: true,
            body: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            subject: true,
            variables: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit)
        }),
        fastify.prisma.emailTemplate.count({ where })
      ]);

      return reply.send({
        data: templates,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    }
  );

  // Create notification template
  fastify.post(
    '/admin/templates',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN']),
        validateRequest(createTemplateSchema)
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      
      const result = await notificationService.createTemplate({
        ...(request.body as any),
        createdBy: user.id
      });
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.code(201).send({
        message: 'Notification template created successfully',
        template: result.data
      });
    }
  );

  // Get notification template
  fastify.get(
    '/admin/templates/:templateId',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { templateId } = (request.params as any) as { templateId: string };
      
      const result = await notificationService.getTemplate(templateId);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send(result.data);
    }
  );

  // Update notification template
  fastify.put(
    '/admin/templates/:templateId',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { templateId } = (request.params as any) as { templateId: string };
      const updateData = (request.body as any) as any;

      const template = await fastify.prisma.emailTemplate.update({
        where: { id: templateId },
        data: updateData
      });

      // Clear cache
      await fastify.redis.del(`template:${(template as any).type}:${(template as any).channel}`);

      return reply.send({
        message: 'Template updated successfully',
        template
      });
    }
  );

  // Delete notification template
  fastify.delete(
    '/admin/templates/:templateId',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { templateId } = (request.params as any) as { templateId: string };

      const template = await fastify.prisma.emailTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        return reply.code(404).send({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      await fastify.prisma.emailTemplate.delete({
        where: { id: templateId }
      });

      // Clear cache
      await fastify.redis.del(`template:${(template as any).type}:${(template as any).channel}`);

      return reply.send({
        message: 'Template deleted successfully'
      });
    }
  );

  // Get notification analytics (Admin only)
  fastify.get(
    '/admin/analytics',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { period = '30' } = (request.query as any) as any;
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(period));

      const result = await notificationService.getNotificationAnalytics({
        startDate,
        endDate
      });
      
      if (!result.success) {
        return reply.code(result.error!.statusCode).send({
          error: result.error!.message,
          code: result.error!.code
        });
      }

      return reply.send({
        ...result.data,
        period: Number(period)
      });
    }
  );

  // Get notification delivery logs (Admin only)
  fastify.get(
    '/admin/delivery-logs',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { 
        page = '1', 
        limit = '20',
        type,
        status,
        dateFrom,
        dateTo
      } = (request.query as any) as any;

      const where: any = {};
      if (type) where.type = type;
      if (status) where.status = status;
      
      if (dateFrom || dateTo) {
        where.sentAt = {};
        if (dateFrom) where.sentAt.gte = new Date(dateFrom);
        if (dateTo) where.sentAt.lte = new Date(dateTo);
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [logs, total] = await Promise.all([
        fastify.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit)
        }),
        fastify.prisma.notification.count({ where })
      ]);

      return reply.send({
        data: logs,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    }
  );

  // Export notifications (Admin only)
  fastify.get(
    '/admin/export',
    {
      preHandler: [
        authenticate,
        authorize(['SUPER_ADMIN', 'ADMIN'])
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { format = 'csv', dateFrom, dateTo, type } = (request.query as any) as any;
      
      const where: any = {};
      if (type) where.type = type;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      const notifications = await fastify.prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10000 // Limit for export
      });

      if (format === 'csv') {
        const csv = convertNotificationsToCSV(notifications);
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=notifications.csv');
        return reply.send(csv);
      }

      return reply.send({
        notifications,
        total: notifications.length,
        exportedAt: new Date().toISOString()
      });
    }
  );
};

// Helper function to convert notifications to CSV
function convertNotificationsToCSV(notifications: any[]): string {
  const headers = [
    'Notification ID',
    'Type',
    'Title',
    'Message',
    'User Email',
    'User Name',
    'Priority',
    'Category',
    'Is Read',
    'Created At',
    'Read At'
  ];

  const rows = notifications.map(notification => [
    notification.id,
    notification.type,
    notification.title,
    notification.message.substring(0, 100) + (notification.message.length > 100 ? '...' : ''),
    notification.user?.email || 'N/A',
    notification.user ? `${notification.user.firstName || ''} ${notification.user.lastName || ''}`.trim() : 'N/A',
    notification.priority,
    notification.category || '',
    notification.isRead ? 'Yes' : 'No',
    notification.createdAt.toISOString(),
    notification.readAt?.toISOString() || ''
  ]);

  return [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default notificationRoutes;
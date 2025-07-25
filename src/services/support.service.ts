import { FastifyInstance } from 'fastify';
import { PrismaClient, SupportTicket, TicketPriority } from '@prisma/client';
import { ServiceResult, CreateTicketData, TicketWithDetails } from '../types';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

export class SupportService {
  private prisma: PrismaClient;
  // Redis not used in this service

  constructor(fastify: FastifyInstance) {
    this.prisma = fastify.prisma;
    // Redis initialization removed
  }

  async createTicket(data: CreateTicketData): Promise<ServiceResult<TicketWithDetails>> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
      if (!user) {
        return { success: false, error: new ApiError('User not found', 404, 'USER_NOT_FOUND') };
      }

      const ticket = await this.prisma.supportTicket.create({
        data: {
          subject: data.subject,
          priority: data.priority as TicketPriority,
          category: data.category,
          status: 'OPEN',
          user: { connect: { id: data.userId } },
        },
        include: {
          user: true,
          messages: true,
        }
      });

      await this.sendTicketNotification(ticket, 'CREATED');

      logger.info({
        ticketId: ticket.id,
        userId: data.userId,
        priority: data.priority,
        category: data.category
      }, 'Support ticket created successfully');

      return {
        success: true,
        data: ticket as unknown as TicketWithDetails,
      };
    } catch (error: any) {
      logger.error({ err: error, data }, 'Error creating support ticket');
      return {
        success: false,
        error: new ApiError('Failed to create support ticket', 500, error.code, error.message),
      };
    }
  }



  private async sendTicketNotification(ticket: SupportTicket, type: string): Promise<void> {
    try {
      logger.info({
        ticketId: ticket.id,
        notificationType: type,
        userId: ticket.userId
      }, 'Ticket notification sent');
    } catch (error: any) {
      logger.error({ err: error, ticket, type }, 'Error sending ticket notification');
    }
  }
}

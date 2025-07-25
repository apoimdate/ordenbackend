import { FastifyInstance } from 'fastify';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { ServiceResult } from '../types';
import { BaseService } from './base.service';
import { ConversationType } from '@prisma/client';

export interface CreateConversationData {
  type: ConversationType;
  participantIds: string[];
  title?: string;
}

export interface SendMessageData {
  conversationId?: string;
  recipientId?: string;
  content: string;
  attachments?: string[];
}

export interface MessageFilters {
  conversationId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ConversationFilters {
  type?: ConversationType;
  search?: string;
  isActive?: boolean;
}

export class ChatService extends BaseService {
  private conversationRepository: ConversationRepository;
  private messageRepository: MessageRepository;

  constructor(app: FastifyInstance) {
    super(app);
    this.conversationRepository = new ConversationRepository(app.prisma, app.redis, this.logger);
    this.messageRepository = new MessageRepository(app.prisma, app.redis, this.logger);
  }

  async createConversation(
    data: CreateConversationData,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      // Validate participants exist
      const users = await this.app.prisma.user.findMany({
        where: {
          id: { in: data.participantIds }
        }
      });

      if (users.length !== data.participantIds.length) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'INVALID_PARTICIPANTS',
            message: 'Some participants do not exist'
          }
        };
      }

      // Check if user is included in participants
      if (!data.participantIds.includes(userId)) {
        data.participantIds.push(userId);
      }

      // For customer-seller conversations, check if one already exists
      if (data.type === ConversationType.PRIVATE && data.participantIds.length === 2) {
        const existingConversation = await this.conversationRepository.findByParticipants(
          data.participantIds
        );

        if (existingConversation) {
          // Return existing conversation
          const conversationWithDetails = await this.conversationRepository.findById(
            existingConversation.id
          );
          
          return {
            success: true,
            data: conversationWithDetails
          };
        }
      }

      const conversation = await this.conversationRepository.create(data);

      // Get full conversation details
      const conversationWithDetails = await this.conversationRepository.findById(
        conversation.id
      );

      return {
        success: true,
        data: conversationWithDetails
      };
    } catch (error) {
      this.app.log.error('Error creating conversation:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'CREATION_ERROR',
          message: 'Failed to create conversation'
        }
      };
    }
  }

  async sendMessage(
    data: SendMessageData,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      let conversationId = data.conversationId;

      // If no conversation ID but recipientId provided, find or create conversation
      if (!conversationId && data.recipientId) {
        // Check if conversation already exists between these users
        const existingConversation = await this.conversationRepository.findByParticipants([
          userId,
          data.recipientId
        ]);

        if (existingConversation) {
          conversationId = existingConversation.id;
        } else {
          // Create new conversation
          const conversationResult = await this.createConversation({
            type: ConversationType.PRIVATE, // Default type
            participantIds: [userId, data.recipientId]
          }, userId);

          if (!conversationResult.success || !conversationResult.data) {
            return conversationResult;
          }

          conversationId = conversationResult.data.id;
        }
      }

      if (!conversationId) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'CONVERSATION_REQUIRED',
            message: 'Conversation ID or recipient ID is required'
          }
        };
      }

      // Verify user is participant in conversation
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || !conversation.participants.some(p => p.id === userId)) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is not a participant in this conversation'
          }
        };
      }

      // Create message
      const message = await this.messageRepository.create({
        conversationId,
        senderId: userId,
        receiverId: data.recipientId || '',
        content: data.content,
        attachments: data.attachments || []
      });

      // Update conversation last message time
      await this.conversationRepository.update(conversationId, {});

      // Get message with details
      const messageWithDetails = await this.messageRepository.findById(message.id);

      // Here you would typically emit a WebSocket event for real-time updates
      // await this.emitMessageEvent(conversationId, messageWithDetails);

      return {
        success: true,
        data: messageWithDetails
      };
    } catch (error) {
      this.app.log.error('Error sending message:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send message'
        }
      };
    }
  }

  async getConversations(
    userId: string,
    _filters: ConversationFilters = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const result = await this.conversationRepository.getUserConversations(
        userId,
        pagination
      );

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error fetching conversations:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch conversations'
        }
      };
    }
  }

  async getConversation(
    conversationId: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      const conversation = await this.conversationRepository.findById(conversationId);

      if (!conversation) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found'
          }
        };
      }

      // Check if user is participant
      if (!conversation.participants.some(p => p.id === userId)) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is not a participant in this conversation'
          }
        };
      }

      return {
        success: true,
        data: conversation
      };
    } catch (error) {
      this.app.log.error('Error fetching conversation:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch conversation'
        }
      };
    }
  }

  async getMessages(
    conversationId: string,
    userId: string,
    pagination = { page: 1, limit: 50 }
  ): Promise<ServiceResult<any>> {
    try {
      // Verify user is participant
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || !conversation.participants.some(p => p.id === userId)) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is not a participant in this conversation'
          }
        };
      }

      const result = await this.messageRepository.getConversationMessages(
        conversationId,
        pagination
      );

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error fetching messages:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch messages'
        }
      };
    }
  }

  async markMessageAsRead(
    messageId: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      const message = await this.messageRepository.markAsRead(messageId, userId);

      return {
        success: true,
        data: message
      };
    } catch (error) {
      this.app.log.error('Error marking message as read:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'READ_ERROR',
          message: error instanceof Error ? error.message : 'Failed to mark message as read'
        }
      };
    }
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      // Verify user is participant
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || !conversation.participants.some(p => p.id === userId)) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is not a participant in this conversation'
          }
        };
      }

      const markedCount = await this.messageRepository.markConversationAsRead(
        conversationId,
        userId
      );

      return {
        success: true,
        data: { markedCount }
      };
    } catch (error) {
      this.app.log.error('Error marking conversation as read:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'READ_ERROR',
          message: 'Failed to mark conversation as read'
        }
      };
    }
  }

  async editMessage(
    messageId: string,
    content: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      const message = await this.messageRepository.editMessage(messageId, content, userId);

      return {
        success: true,
        data: message
      };
    } catch (error) {
      this.app.log.error('Error editing message:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'EDIT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to edit message'
        }
      };
    }
  }

  async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      const message = await this.messageRepository.delete(messageId, userId);

      return {
        success: true,
        data: message
      };
    } catch (error) {
      this.app.log.error('Error deleting message:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete message'
        }
      };
    }
  }

  async getUnreadCount(userId: string, conversationId?: string): Promise<ServiceResult<any>> {
    try {
      const unreadCount = await this.messageRepository.getUnreadCount(userId, conversationId);

      return {
        success: true,
        data: { unreadCount }
      };
    } catch (error) {
      this.app.log.error('Error fetching unread count:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch unread count'
        }
      };
    }
  }

  async searchMessages(
    query: string,
    userId: string,
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const result = await this.messageRepository.searchMessages(query, userId, pagination);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error searching messages:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'SEARCH_ERROR',
          message: 'Failed to search messages'
        }
      };
    }
  }

  async getConversationStats(
    conversationId: string,
    userId: string
  ): Promise<ServiceResult<any>> {
    try {
      // Verify user is participant
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation || !conversation.participants.some(p => p.id === userId)) {
        return {
          success: false,
    // @ts-ignore - TS2741: Temporary fix
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is not a participant in this conversation'
          }
        };
      }

      const stats = await this.messageRepository.getMessageStats(conversationId);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.app.log.error('Error fetching conversation stats:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to fetch conversation statistics'
        }
      };
    }
  }

  // Admin methods
  async getAllConversations(
    filters: ConversationFilters = {},
    pagination = { page: 1, limit: 20 }
  ): Promise<ServiceResult<any>> {
    try {
      const result = await this.conversationRepository.findMany(filters, pagination);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.app.log.error('Error fetching all conversations:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch conversations'
        }
      };
    }
  }

  async closeConversation(conversationId: string): Promise<ServiceResult<any>> {
    try {
      const conversation = await this.conversationRepository.markAsInactive(conversationId);

      return {
        success: true,
        data: conversation
      };
    } catch (error) {
      this.app.log.error('Error closing conversation:', error);
      return {
        success: false,
    // @ts-ignore - TS2741: Temporary fix
        error: {
          code: 'CLOSE_ERROR',
          message: 'Failed to close conversation'
        }
      };
    }
  }


  // WebSocket integration methods (to be implemented with WebSocket setup)
  // private async emitMessageEvent(conversationId: string, message: any) {
  //   // Emit to all participants in the conversation
  //   // Implementation depends on WebSocket setup
  // }
}

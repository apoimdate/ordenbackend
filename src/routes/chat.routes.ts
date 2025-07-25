import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { ChatService } from '../services/chat.service';
import { z } from 'zod';
import { ConversationType } from '@prisma/client';

// Validation schemas
const createConversationSchema = z.object({
  type: z.nativeEnum(ConversationType),
  participantIds: z.array(z.string().min(1)).min(1),
  title: z.string().optional()
});

const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  recipientId: z.string().optional(),
  type: z.enum(['TEXT', 'IMAGE', 'FILE', 'SYSTEM']).default('TEXT'),
  content: z.string().min(1),
  attachments: z.array(z.string()).optional()
});

const editMessageSchema = z.object({
  content: z.string().min(1)
});

const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

const conversationFiltersSchema = z.object({
  type: z.nativeEnum(ConversationType).optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

export async function chatRoutes(fastify: FastifyInstance) {
  const chatService = new ChatService(fastify);

  // User Chat Routes

  // Get chat overview (redirect to conversations)
  fastify.get('/chat', {
    schema: {
      description: 'Get user chat conversations with filters (requires authentication)',
      summary: 'Get chat conversations',
      tags: ['Chat'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.values(ConversationType) },
          search: { type: 'string' },
          isActive: { type: 'boolean' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      }
    },
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const filters = conversationFiltersSchema.parse((request.query as any));

      const { page, limit, ...filterData } = filters;

      const result = await chatService.getConversations(
        user.userId,
        filterData,
        { page, limit }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch conversations'
        });
      }

      return reply.send({
        message: 'Conversations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching conversations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Create a new conversation
  fastify.post('/chat/conversations', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const conversationData = createConversationSchema.parse((request.body as any));

      const result = await chatService.createConversation(conversationData, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to create conversation'
        });
      }

      return reply.code(201).send({
        message: 'Conversation created successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error creating conversation:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get user's conversations
  fastify.get('/chat/conversations', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const filters = conversationFiltersSchema.parse((request.query as any));

      const { page, limit, ...filterData } = filters;

      const result = await chatService.getConversations(
        user.id,
        filterData,
        { page, limit }
      );

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch conversations'
        });
      }

      return reply.send({
        message: 'Conversations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching conversations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get specific conversation
  fastify.get('/chat/conversations/:conversationId', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { conversationId } = (request.params as any);

      const result = await chatService.getConversation(conversationId, user.id);

      if (!result.success) {
        return reply.code(404).send({
          error: result.error?.message || 'Conversation not found'
        });
      }

      return reply.send({
        message: 'Conversation fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching conversation:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Send a message
  fastify.post('/chat/messages', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const messageData = sendMessageSchema.parse((request.body as any));

      const result = await chatService.sendMessage(messageData, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to send message'
        });
      }

      return reply.code(201).send({
        message: 'Message sent successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error sending message:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get messages in a conversation
  fastify.get('/chat/conversations/:conversationId/messages', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { conversationId } = (request.params as any);
      const pagination = paginationSchema.parse((request.query as any));

      const result = await chatService.getMessages(conversationId, user.id, pagination);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch messages'
        });
      }

      return reply.send({
        message: 'Messages fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching messages:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Mark message as read
  fastify.patch('/chat/messages/:messageId/read', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { messageId } = (request.params as any);

      const result = await chatService.markMessageAsRead(messageId, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to mark message as read'
        });
      }

      return reply.send({
        message: 'Message marked as read successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error marking message as read:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Mark entire conversation as read
  fastify.patch('/chat/conversations/:conversationId/read', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { conversationId } = (request.params as any);

      const result = await chatService.markConversationAsRead(conversationId, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to mark conversation as read'
        });
      }

      return reply.send({
        message: 'Conversation marked as read successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error marking conversation as read:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Edit a message
  fastify.patch('/chat/messages/:messageId', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { messageId } = (request.params as any);
      const { content } = editMessageSchema.parse((request.body as any));

      const result = await chatService.editMessage(messageId, content, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to edit message'
        });
      }

      return reply.send({
        message: 'Message edited successfully',
        data: result.data
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors
        });
      }

      fastify.log.error('Error editing message:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Delete a message
  fastify.delete('/chat/messages/:messageId', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { messageId } = (request.params as any);

      const result = await chatService.deleteMessage(messageId, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to delete message'
        });
      }

      return reply.send({
        message: 'Message deleted successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error deleting message:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get unread message count
  fastify.get('/chat/unread-count', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { conversationId } = (request.query as any);

      const result = await chatService.getUnreadCount(user.id, conversationId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch unread count'
        });
      }

      return reply.send({
        message: 'Unread count fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching unread count:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Search messages
  fastify.get('/chat/search', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { query, page = 1, limit = 20 } = (request.query as any);

      if (!query || query.trim().length === 0) {
        return reply.code(400).send({
          error: 'Search query is required'
        });
      }

      const result = await chatService.searchMessages(query, user.id, { page, limit });

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to search messages'
        });
      }

      return reply.send({
        message: 'Message search completed successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error searching messages:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Get conversation statistics
  fastify.get('/chat/conversations/:conversationId/stats', {
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply) => {
    try {
      const user = (request as any).user;
      const { conversationId } = (request.params as any);

      const result = await chatService.getConversationStats(conversationId, user.id);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch conversation statistics'
        });
      }

      return reply.send({
        message: 'Conversation statistics fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching conversation statistics:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Admin Routes

  // Get all conversations (admin only)
  fastify.get('/admin/chat/conversations', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const filters = conversationFiltersSchema.parse((request.query as any));
      const { page, limit, ...filterData } = filters;

      const result = await chatService.getAllConversations(filterData, { page, limit });

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to fetch conversations'
        });
      }

      return reply.send({
        message: 'Conversations fetched successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error fetching admin conversations:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Close/deactivate a conversation (admin only)
  fastify.patch('/admin/chat/conversations/:conversationId/close', {
    preHandler: [authenticate, requireRole('ADMIN', 'SUPER_ADMIN')]
  }, async (request: FastifyRequest, reply) => {
    try {
      const { conversationId } = (request.params as any);

      const result = await chatService.closeConversation(conversationId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error?.message || 'Failed to close conversation'
        });
      }

      return reply.send({
        message: 'Conversation closed successfully',
        data: result.data
      });
    } catch (error) {
      fastify.log.error('Error closing conversation:', error);
      return reply.code(500).send({
        error: 'Internal server error'
      });
    }
  });
}

import { Prisma, Conversation, Message, ConversationType, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export interface ConversationWithDetails extends Conversation {
  messages: Message[];
  participants: User[];
  messageCount: number;
  lastMessage?: Message;
}

export interface ConversationCreateData {
  type: ConversationType;
  participantIds: string[];
  title?: string;
}

export interface ConversationUpdateData {
  title?: string;
  isActive?: boolean;
}

export interface ConversationFilters {
  type?: ConversationType;
  participantIds?: string[];
  isActive?: boolean;
  search?: string;
}

export class ConversationRepository {
  protected prisma: PrismaClient;
  protected redis: Redis;
  protected logger: Logger;

  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
  }
  async create(data: ConversationCreateData): Promise<Conversation> {
    const { participantIds, ...rest } = data;
    return this.prisma.conversation.create({
      data: {
        ...rest,
        participants: {
          connect: participantIds.map(id => ({ id })),
        },
      },
    });
  }

  async findById(id: string): Promise<ConversationWithDetails | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Last 50 messages
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    }) as Promise<ConversationWithDetails | null>;
  }

  async findByParticipants(participantIds: string[]): Promise<Conversation | null> {
    // Find conversation where all participants are included
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          every: {
            id: {
              in: participantIds,
            },
          },
        },
      },
      include: {
        participants: true,
      },
    });

    // Return the conversation with exact same participants
    return conversations.find(conv => 
      conv.participants.length === participantIds.length &&
      participantIds.every(p => conv.participants.map(cp => cp.id).includes(p))
    ) || null;
  }

  async findMany(filters: ConversationFilters = {}, pagination = { page: 1, limit: 20 }) {
    const where: Prisma.ConversationWhereInput = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.participantIds?.length) {
      where.participants = {
        some: {
          id: {
            in: filters.participantIds,
          },
        },
      };
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          participants: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Last message only
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pagination.limit
      }),
      this.prisma.conversation.count({ where })
    ]);

    return {
      conversations,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async update(id: string, data: ConversationUpdateData): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data
    });
  }

  async markAsActive(id: string): Promise<Conversation> {
    return this.update(id, { 
      isActive: true,
    });
  }

  async markAsInactive(id: string): Promise<Conversation> {
    return this.update(id, { isActive: false });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.conversation.delete({
      where: { id }
    });
  }

  async getUserConversations(userId: string, pagination = { page: 1, limit: 20 }) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              id: userId
            }
          },
        },
        include: {
          participants: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pagination.limit
      }),
      this.prisma.conversation.count({
        where: {
          participants: {
            some: {
              id: userId
            }
          },
        }
      })
    ]);

    return {
      conversations,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async getConversationStats(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });

    if (!conversation) return null;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: id,
        isRead: false
      }
    });

    return {
      id: conversation.id,
      messageCount: conversation._count.messages,
      unreadCount,
      lastActivity: conversation.updatedAt,
    };
  }
}

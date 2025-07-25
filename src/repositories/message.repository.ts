import { Prisma, Message } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export interface MessageWithDetails extends Message {
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  receiver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  conversation: {
    id: string;
    type: string;
    participants: { id: string }[];
  };
}

export interface MessageCreateData {
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachments?: Prisma.InputJsonValue;
}

export interface MessageUpdateData {
  content?: string;
  isRead?: boolean;
}

export interface MessageFilters {
  conversationId?: string;
  senderId?: string;
  receiverId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class MessageRepository {
  protected prisma: PrismaClient;
  protected redis: Redis;
  protected logger: Logger;

  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
  }
  async create(data: MessageCreateData): Promise<Message> {
    return this.prisma.message.create({
      data
    });
  }

  async findById(id: string): Promise<MessageWithDetails | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        conversation: {
          select: {
            id: true,
            type: true,
            participants: {
              select: {
                id: true
              }
            }
          }
        }
      }
    }) as Promise<MessageWithDetails | null>;
  }

  async findMany(filters: MessageFilters = {}, pagination = { page: 1, limit: 50 }) {
    const where: Prisma.MessageWhereInput = {};

    if (filters.conversationId) {
      where.conversationId = filters.conversationId;
    }

    if (filters.senderId) {
      where.senderId = filters.senderId;
    }

    if (filters.receiverId) {
      where.receiverId = filters.receiverId;
    }

    if (filters.search) {
      where.content = {
        contains: filters.search,
        mode: 'insensitive'
      };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit
      }),
      this.prisma.message.count({ where })
    ]);

    return {
      messages,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async getConversationMessages(
    conversationId: string, 
    pagination = { page: 1, limit: 50 }
  ) {
    return this.findMany(
      { conversationId },
      pagination
    );
  }

  async update(id: string, data: MessageUpdateData): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data
    });
  }

  async markAsRead(id: string, userId: string): Promise<Message> {
    // Only allow receiver to mark as read
    const message = await this.prisma.message.findUnique({
      where: { id }
    });

    if (!message || message.receiverId !== userId) {
      throw new Error('Unauthorized to mark message as read');
    }

    return this.update(id, {
      isRead: true,
    });
  }

  async editMessage(id: string, content: string, userId: string): Promise<Message> {
    // Only allow sender to edit
    const message = await this.prisma.message.findUnique({
      where: { id }
    });

    if (!message || message.senderId !== userId) {
      throw new Error('Unauthorized to edit message');
    }

    return this.prisma.message.update({
        where: {id},
        data: {
            content,
        }
    });
  }

  async delete(id: string, userId: string): Promise<Message> {
    // Only allow sender to delete
    const message = await this.prisma.message.findUnique({
      where: { id }
    });

    if (!message || message.senderId !== userId) {
      throw new Error('Unauthorized to delete message');
    }

    return this.prisma.message.delete({
        where: {id}
    });
  }

  async getUnreadCount(userId: string, conversationId?: string): Promise<number> {
    const where: Prisma.MessageWhereInput = {
      receiverId: userId,
      isRead: false,
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    return this.prisma.message.count({ where });
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<number> {
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      }
    });

    return result.count;
  }

  async getMessageStats(conversationId: string) {
    const totalMessages = await this.prisma.message.count({
      where: {
        conversationId,
      }
    });

    const attachmentCount = await this.prisma.message.count({
      where: {
        conversationId,
        attachments: {
            not: Prisma.JsonNull
        },
      }
    });

    return {
      totalMessages,
      attachmentCount,
    };
  }

  async searchMessages(
    query: string,
    userId: string,
    pagination = { page: 1, limit: 20 }
  ) {
    const skip = (pagination.page - 1) * pagination.limit;

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ],
        content: {
          contains: query,
          mode: 'insensitive'
        },
      },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            participants: {
                select: {
                    id: true
                }
            }
          }
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pagination.limit
    });

    const total = await this.prisma.message.count({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ],
        content: {
          contains: query,
          mode: 'insensitive'
        },
      }
    });

    return {
      messages,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }
}

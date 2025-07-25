import { User, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class UserRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'user', 300);
  }

  async findByEmail(email: string, options?: FindOptionsWithoutWhere): Promise<User | null> {
    return this.findUnique({ email: email.toLowerCase() }, options);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: FindOptionsWithoutWhere
  ): Promise<User[]> {
    return this.findMany({
      ...options,
      where: {
        
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  }

  async findRecent(days: number = 7, options?: FindOptionsWithoutWhere): Promise<User[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.findMany({
      ...options,
      where: {
        
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
  async findByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
    return this.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLowerCase() },
        ]
      }
    });
  }

  async updateLastLogin(userId: string): Promise<User> {
    return this.update(userId, { lastLoginAt: new Date() } as any);
  }
}
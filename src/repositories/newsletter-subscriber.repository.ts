import { NewsletterSubscriber, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class NewsletterSubscriberRepository extends BaseRepository<
  NewsletterSubscriber,
  Prisma.NewsletterSubscriberCreateInput,
  Prisma.NewsletterSubscriberUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'newsletterSubscriber', 300);
  }

  async findByEmail(email: string, options?: FindOptionsWithoutWhere): Promise<NewsletterSubscriber | null> {
    return this.findUnique({ email: email.toLowerCase() }, options);
  }

  async findActive(options?: FindOptionsWithoutWhere): Promise<NewsletterSubscriber[]> {
    return this.findMany({
      ...options,
      where: {
        
        isActive: true
      }
    });
  }
}
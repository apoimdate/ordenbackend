import { SurveyResponse, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ReviewResponseRepository extends BaseRepository<
  SurveyResponse,
  Prisma.SurveyResponseCreateInput,
  Prisma.SurveyResponseUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'surveyResponse', 300);
  }

  async findByReviewId(reviewId: string) {
    return this.findMany({
      where: { reviewId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByUserId(userId: string) {
    return this.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findSellerResponses(userId: string) {
    return this.findMany({
      where: {
        userId,
        isSellerResponse: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async countByReviewId(reviewId: string): Promise<number> {
    return this.count({
      where: { reviewId }
    });
  }

  async deleteByReviewId(reviewId: string) {
    return (this.prisma as any).reviewResponse.deleteMany({
      where: { reviewId }
    });
  }
}

import { Review, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class ReviewVoteRepository extends BaseRepository<
  Review,
  Prisma.ReviewCreateInput,
  Prisma.ReviewUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'reviewVote', 300);
  }

  async findByReviewId(reviewId: string) {
    return this.findMany({
      where: { reviewId }
    });
  }

  async findByUserId(userId: string) {
    return this.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findUserVote(reviewId: string, userId: string) {
    // @ts-ignore - TS2339: Temporary fix
    return this.prisma.reviewVote.findFirst({
      where: {
        reviewId,
        userId
      }
    });
  }

  async countVotesByType(reviewId: string) {
    // @ts-ignore - TS2339: Temporary fix
    const votes = await this.prisma.reviewVote.groupBy({
      by: ['voteType'],
      where: { reviewId },
      _count: {
        voteType: true
      }
    });

    return {
      helpful: votes.find((v: any) => v.voteType === 'helpful')?._count.voteType || 0,
      notHelpful: votes.find((v: any) => v.voteType === 'not_helpful')?._count.voteType || 0
    };
  }

  async deleteByReviewId(reviewId: string) {
    return (this.prisma as any).reviewVote.deleteMany({
      where: { reviewId }
    });
  }

  async upsertVote(reviewId: string, userId: string, voteType: string) {
    // Find existing vote
    // @ts-ignore - TS2339: Temporary fix
    const existingVote = await this.prisma.reviewVote.findFirst({
      where: { reviewId, userId }
    });
    
    if (existingVote) {
    // @ts-ignore - TS2339: Temporary fix
      return this.prisma.reviewVote.update({
        where: { id: existingVote.id },
        data: { voteType, updatedAt: new Date() }
      });
    } else {
    // @ts-ignore - TS2339: Temporary fix
      return this.prisma.reviewVote.create({
        data: { reviewId, userId, voteType }
      });
    }
  }
}

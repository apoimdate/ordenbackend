import { SellerReview, Prisma, ReviewStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';
import { nanoid } from 'nanoid';

interface CreateSellerReviewData {
  sellerId: string;
  orderId: string;
  userId: string;
  rating: number;
  comment?: string;
}

interface SellerReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  recentTrend: {
    last30Days: number;
    previousPeriod: number;
    trendPercentage: number;
  };
}

interface SellerReviewWithDetails extends SellerReview {
  seller?: {
    id: string;
    businessName: string;
  };
}

export class SellerReviewService extends CrudService<SellerReview> {
  modelName = 'sellerReview' as const;

  constructor(app: FastifyInstance) {
    super(app);
  }

  /**
   * Create a new seller review
   */
  async createReview(data: CreateSellerReviewData): Promise<ServiceResult<SellerReview>> {
    try {
      // Validate seller exists
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId }
      });
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Validate order exists and belongs to user
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
        include: {
          items: {
            include: {
              product: {
                select: { sellerId: true }
              }
            }
          }
        }
      });

      if (!order) {
        return {
          success: false,
          error: new ApiError('Order not found', 404, 'ORDER_NOT_FOUND')
        };
      }

      if (order.userId !== data.userId) {
        return {
          success: false,
          error: new ApiError('Order does not belong to user', 403, 'INVALID_ORDER_USER')
        };
      }

      // Validate order contains products from this seller
      const hasSellerProducts = order.items.some(item => item.product.sellerId === data.sellerId);
      if (!hasSellerProducts) {
        return {
          success: false,
          error: new ApiError('Order does not contain products from this seller', 400, 'NO_SELLER_PRODUCTS')
        };
      }

      // Check if user already reviewed this seller for this order
      const existingReview = await this.prisma.sellerReview.findFirst({
        where: {
          sellerId: data.sellerId,
          orderId: data.orderId,
          userId: data.userId
        }
      });

      if (existingReview) {
        return {
          success: false,
          error: new ApiError('You have already reviewed this seller for this order', 400, 'REVIEW_EXISTS')
        };
      }

      // Validate ratings
      if (data.rating < 1 || data.rating > 5) {
        return {
          success: false,
          error: new ApiError('Rating must be between 1 and 5', 400, 'INVALID_RATING')
        };
      }

      // Create review
      const review = await this.prisma.sellerReview.create({
        data: {
          id: nanoid(),
          sellerId: data.sellerId,
          orderId: data.orderId,
          userId: data.userId,
          rating: data.rating,
          comment: data.comment,
          status: 'PENDING' as ReviewStatus
        }
      });

      // Clear seller cache
      await cache.invalidatePattern(`seller:${data.sellerId}:*`);
      await cache.invalidatePattern(`seller:reviews:*`);

      // Emit event
      this.app.events?.emit('seller.review.created', {
        reviewId: review.id,
        sellerId: data.sellerId,
        userId: data.userId,
        rating: data.rating
      });

      return { success: true, data: review };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create seller review');
      return {
        success: false,
        error: new ApiError('Failed to create review', 500, 'CREATE_REVIEW_ERROR')
      };
    }
  }

  /**
   * Get seller reviews with pagination
   */
  async getSellerReviews(sellerId: string, options: {
    page?: number;
    limit?: number;
    rating?: number;
    sortBy?: 'newest' | 'oldest' | 'rating_high' | 'rating_low';
  } = {}): Promise<ServiceResult<PaginatedResult<SellerReview>>> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { id: sellerId }
      });
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Build filters
      const where: Prisma.SellerReviewWhereInput = {
        sellerId,
        status: 'APPROVED' as ReviewStatus
      };

      if (options.rating !== undefined) {
        where.rating = options.rating;
      }

      // Build sort order
      let orderBy: Prisma.SellerReviewOrderByWithRelationInput = { createdAt: 'desc' };
      switch (options.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'rating_high':
          orderBy = { rating: 'desc' };
          break;
        case 'rating_low':
          orderBy = { rating: 'asc' };
          break;
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        this.prisma.sellerReview.findMany({
          where,
          orderBy,
          skip,
          take: limit
        }),
        this.prisma.sellerReview.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: reviews,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller reviews');
      return {
        success: false,
        error: new ApiError('Failed to get reviews', 500, 'GET_REVIEWS_ERROR')
      };
    }
  }

  /**
   * Get seller review statistics
   */
  async getSellerReviewStats(sellerId: string): Promise<ServiceResult<SellerReviewStats>> {
    try {
      const cacheKey = `seller:${sellerId}:review_stats`;
      const cached = await cache.get<SellerReviewStats>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const seller = await this.prisma.seller.findUnique({
        where: { id: sellerId }
      });
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND')
        };
      }

      // Get all approved reviews
      const allReviews = await this.prisma.sellerReview.findMany({
        where: {
          sellerId,
          status: 'APPROVED' as ReviewStatus
        },
        select: {
          rating: true,
          createdAt: true
        }
      });

      const totalReviews = allReviews.length;

      if (totalReviews === 0) {
        const emptyStats: SellerReviewStats = {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          recentTrend: {
            last30Days: 0,
            previousPeriod: 0,
            trendPercentage: 0
          }
        };
        await cache.set(cacheKey, emptyStats, { ttl: 3600 });
        return { success: true, data: emptyStats };
      }

      // Calculate metrics
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let ratingSum = 0;

      allReviews.forEach(review => {
        ratingSum += review.rating;
        ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
      });

      // Calculate trend
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const last30DaysReviews = allReviews.filter(r => r.createdAt >= thirtyDaysAgo).length;
      const previousPeriodReviews = allReviews.filter(r => 
        r.createdAt >= sixtyDaysAgo && r.createdAt < thirtyDaysAgo
      ).length;

      const trendPercentage = previousPeriodReviews > 0 
        ? ((last30DaysReviews - previousPeriodReviews) / previousPeriodReviews) * 100
        : last30DaysReviews > 0 ? 100 : 0;

      const stats: SellerReviewStats = {
        averageRating: Math.round((ratingSum / totalReviews) * 100) / 100,
        totalReviews,
        ratingDistribution,
        recentTrend: {
          last30Days: last30DaysReviews,
          previousPeriod: previousPeriodReviews,
          trendPercentage: Math.round(trendPercentage * 100) / 100
        }
      };

      await cache.set(cacheKey, stats, { ttl: 3600 });
      return { success: true, data: stats };
    } catch (error) {
      this.logger.error({ error, sellerId }, 'Failed to get seller review stats');
      return {
        success: false,
        error: new ApiError('Failed to get review stats', 500, 'REVIEW_STATS_ERROR')
      };
    }
  }

  /**
   * Update review status (admin only)
   */
  async updateReviewStatus(reviewId: string, status: ReviewStatus): Promise<ServiceResult<SellerReview>> {
    try {
      const review = await this.prisma.sellerReview.findUnique({
        where: { id: reviewId }
      });

      if (!review) {
        return {
          success: false,
          error: new ApiError('Review not found', 404, 'REVIEW_NOT_FOUND')
        };
      }

      if (review.status !== 'PENDING') {
        return {
          success: false,
          error: new ApiError('Review has already been moderated', 400, 'REVIEW_ALREADY_MODERATED')
        };
      }

      const updatedReview = await this.prisma.sellerReview.update({
        where: { id: reviewId },
        data: { status }
      });

      // Clear cache
      await cache.invalidatePattern(`seller:${review.sellerId}:*`);

      // Update seller stats if approved
      if (status === 'APPROVED') {
        this.app.events?.emit('seller.review.approved', {
          reviewId: review.id,
          sellerId: review.sellerId,
          rating: review.rating
        });
      }

      return { success: true, data: updatedReview };
    } catch (error) {
      this.logger.error({ error, reviewId }, 'Failed to update review status');
      return {
        success: false,
        error: new ApiError('Failed to update review status', 500, 'UPDATE_STATUS_ERROR')
      };
    }
  }

  /**
   * Get pending reviews for moderation
   */
  async getPendingReviews(options: {
    page?: number;
    limit?: number;
  } = {}): Promise<ServiceResult<PaginatedResult<SellerReviewWithDetails>>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const where: Prisma.SellerReviewWhereInput = {
        status: 'PENDING' as ReviewStatus
      };

      const [reviews, total] = await Promise.all([
        this.prisma.sellerReview.findMany({
          where,
          include: {
            seller: {
              select: {
                id: true,
                businessName: true
              }
            }
          },
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit
        }),
        this.prisma.sellerReview.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: reviews as SellerReviewWithDetails[],
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get pending reviews');
      return {
        success: false,
        error: new ApiError('Failed to get pending reviews', 500, 'GET_PENDING_ERROR')
      };
    }
  }

  /**
   * Get top rated sellers
   */
  async getTopRatedSellers(options: {
    minReviews?: number;
    limit?: number;
    period?: 'all' | 'month' | 'year';
  } = {}): Promise<ServiceResult<Array<{
    sellerId: string;
    businessName: string;
    averageRating: number;
    totalReviews: number;
  }>>> {
    try {
      const cacheKey = `sellers:top_rated:${JSON.stringify(options)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let dateFilter = {};
      if (options.period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = { createdAt: { gte: monthAgo } };
      } else if (options.period === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateFilter = { createdAt: { gte: yearAgo } };
      }

      // Get seller review aggregations
      const sellerStats = await this.prisma.sellerReview.groupBy({
        by: ['sellerId'],
        where: {
          status: 'APPROVED' as ReviewStatus,
          ...dateFilter
        },
        _count: true,
        _avg: {
          rating: true
        }
      });

      // Filter by minimum reviews
      const minReviews = options.minReviews || 5;
      const qualifiedSellers = sellerStats
        .filter(stat => stat._count >= minReviews)
        .sort((a, b) => (b._avg.rating || 0) - (a._avg.rating || 0))
        .slice(0, options.limit || 10);

      // Get seller details
      const topSellers = await Promise.all(
        qualifiedSellers.map(async (stat) => {
          const seller = await this.prisma.seller.findUnique({
            where: { id: stat.sellerId },
            select: { businessName: true }
          });

          return {
            sellerId: stat.sellerId,
            businessName: seller?.businessName || 'Unknown',
            averageRating: Math.round((stat._avg.rating || 0) * 100) / 100,
            totalReviews: stat._count
          };
        })
      );

      await cache.set(cacheKey, topSellers, { ttl: 3600 });
      return { success: true, data: topSellers };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get top rated sellers');
      return {
        success: false,
        error: new ApiError('Failed to get top sellers', 500, 'TOP_SELLERS_ERROR')
      };
    }
  }
}
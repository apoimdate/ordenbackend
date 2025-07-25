import { Review, Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import {
  ReviewRepository,
  ProductRepository,
  OrderItemRepository,
} from '../repositories';
import { ServiceResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { updateSearchIndex } from '../utils/search';

interface CreateProductReviewData {
  productId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title: string;
  content: string;
  pros?: string;
  cons?: string;
  wouldRecommend?: boolean;
  verifiedPurchase?: boolean;
  images?: string[];
  metadata?: Record<string, any>;
}

export class ReviewService extends CrudService<Review> {
  modelName: 'review' = 'review';

  private reviewRepo: ReviewRepository;
  private productRepo: ProductRepository;
  private orderItemRepo: OrderItemRepository;

  constructor(app: FastifyInstance) {
    super(app);
    this.reviewRepo = new ReviewRepository(this.prisma, this.redis, this.logger);
    this.productRepo = new ProductRepository(this.prisma, this.redis, this.logger);
    this.orderItemRepo = new OrderItemRepository(this.prisma, this.redis, this.logger);
  }

  // Product Review Management
  async createProductReview(
    data: CreateProductReviewData
  ): Promise<ServiceResult<Review>> {
    try {
      // Validate product exists
      const product = await this.productRepo.findById(data.productId);
      if (!product) {
        return {
          success: false,
          error: new ApiError(
            'Product not found or inactive',
            404,
            'PRODUCT_NOT_FOUND'
          ),
        };
      }

      // Check if user already reviewed this product
      const existingReview = await this.reviewRepo.findFirst({
        where: {
          productId: data.productId,
          userId: data.userId,
        },
      });

      if (existingReview) {
        return {
          success: false,
          error: new ApiError(
            'You have already reviewed this product',
            400,
            'REVIEW_EXISTS'
          ),
        };
      }

      // Verify purchase if orderId provided
      let verifiedPurchase = false;
      if (data.orderId) {
        const orderItem = await this.orderItemRepo.findFirst({
          where: {
            order: {
              id: data.orderId,
              userId: data.userId,
              status: 'DELIVERED',
            },
          },
        });
        verifiedPurchase = !!orderItem;
      }

      const review = await this.prisma.$transaction(async (tx) => {
        // Create review
        const newReview = await tx.review.create({
          data: {
            product: { connect: { id: data.productId } },
            user: { connect: { id: data.userId } },
            rating: data.rating,
            title: data.title,
            content: data.content,
            pros: data.pros,
            cons: data.cons,
            wouldRecommend: data.wouldRecommend,
            isVerified: verifiedPurchase,
            images: data.images,
            metadata: data.metadata,
          },
        });

        // Update product average rating
        await this.updateProductRating(data.productId, tx as Prisma.TransactionClient);

        return newReview;
      });

      // Update search index
      await updateSearchIndex('reviews', {
        id: review.id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        title: review.title,
        content: review.content,
        verifiedPurchase: review.isVerified,
        status: review.status,
        createdAt: review.createdAt.getTime(),
      });

      // Emit review created event
      this.app.log.info(`Emitting review.created event for review ${review.id}`);
      /* this.app.events?.emit('review.created', {
        reviewId: review.id,
        productId: data.productId,
        userId: data.userId,
        rating: data.rating,
        verifiedPurchase
      }); */

      // Clear product rating cache
      await cache.invalidatePattern(`product:${data.productId}:rating:*`);

      this.app.log.info(
        {
          reviewId: review.id,
          productId: data.productId,
          userId: data.userId,
          rating: data.rating,
        },
        'Product review created'
      );

      return {
        success: true,
        data: review,
      };
    } catch (error: any) {
      this.app.log.error({ error }, 'Failed to create product review');
      return {
        success: false,
        error:
          error instanceof ApiError
            ? error
            : new ApiError('Failed to create product review', 500, error.code, error.message),
      };
    }
  }

  private async updateProductRating(
    productId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const stats = await tx.review.aggregate({
      where: {
        productId,
        status: 'APPROVED',
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    await tx.product.update({
      where: { id: productId },
      data: {
        averageRating: Number(stats._avg.rating || 0),
        reviewCount: Number(stats._count.id || 0),
      },
    });
  }
}

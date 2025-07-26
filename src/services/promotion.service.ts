import { Promotion, Prisma, PromotionType } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';
import { nanoid } from 'nanoid';

interface CreatePromotionData {
  name: string;
  description?: string;
  type: PromotionType;
  value: number;
  validFrom: Date;
  validTo: Date;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  conditions?: Prisma.JsonValue;
  isActive?: boolean;
  // Product/Category targeting
  productIds?: string[];
  categoryIds?: string[];
  excludeProductIds?: string[];
  // User targeting
  userIds?: string[];
  membershipLevels?: string[];
  // Additional settings
  stackable?: boolean;
  priority?: number;
}

interface PromotionValidation {
  isValid: boolean;
  reason?: string;
  applicableProducts?: string[];
  discountAmount?: number;
}

interface PromotionStats {
  totalUsage: number;
  totalDiscountGiven: number;
  uniqueUsers: number;
  averageOrderValue: number;
  conversionRate: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    usageCount: number;
    totalDiscount: number;
  }>;
  dailyUsage: Array<{
    date: Date;
    usageCount: number;
    discountAmount: number;
  }>;
}

export class PromotionService extends CrudService<Promotion> {
  modelName = 'promotion' as const;

  constructor(app: FastifyInstance) {
    super(app);
  }

  /**
   * Create a new promotion
   */
  async createPromotion(data: CreatePromotionData): Promise<ServiceResult<Promotion>> {
    try {
          // Validate dates
      if (data.validFrom >= data.validTo) {
        return {
          success: false,
          error: new ApiError('Valid to date must be after valid from date', 400, 'INVALID_DATES')
        };
      }

      // Validate value based on type
      if (data.type === 'PERCENTAGE' && (data.value <= 0 || data.value > 100)) {
        return {
          success: false,
          error: new ApiError('Percentage value must be between 0 and 100', 400, 'INVALID_PERCENTAGE')
        };
      }

      if (data.type === 'FIXED_AMOUNT' && data.value <= 0) {
        return {
          success: false,
          error: new ApiError('Fixed amount must be greater than 0', 400, 'INVALID_AMOUNT')
        };
      }

      // Check name uniqueness (business rule)
      const existingPromotion = await this.prisma.promotion.findFirst({
        where: { 
          name: data.name,
          isActive: true
        }
      });

      if (existingPromotion) {
        return {
          success: false,
          error: new ApiError('Active promotion with this name already exists', 400, 'DUPLICATE_ACTIVE_NAME')
        };
      }

      // Validate product IDs if provided
      if (data.productIds?.length) {
        const products = await this.prisma.product.count({
          where: { id: { in: data.productIds } }
        });
        if (products !== data.productIds.length) {
          return {
            success: false,
            error: new ApiError('Some product IDs are invalid', 400, 'INVALID_PRODUCTS')
          };
        }
      }

      // Validate category IDs if provided
      if (data.categoryIds?.length) {
        const categories = await this.prisma.category.count({
          where: { id: { in: data.categoryIds } }
        });
        if (categories !== data.categoryIds.length) {
          return {
            success: false,
            error: new ApiError('Some category IDs are invalid', 400, 'INVALID_CATEGORIES')
          };
        }
      }

      // Create promotion
      const promotion = await this.prisma.promotion.create({
        data: {
          id: nanoid(),
          name: data.name,
          description: data.description,
          type: data.type,
          value: data.value,
          validFrom: data.validFrom,
          validTo: data.validTo,
          conditions: data.conditions || {},
          isActive: data.isActive ?? true,
          priority: data.priority || 0
        }
      });

      // Clear cache
      await cache.invalidatePattern('promotions:*');

      // Emit event
      this.app.events?.emit('promotion.created', {
        promotionId: promotion.id,
        name: promotion.name,
        type: promotion.type
      });

      return { success: true, data: promotion };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create promotion');
      return {
        success: false,
        error: new ApiError('Failed to create promotion', 500, 'CREATE_PROMOTION_ERROR')
      };
    }
  }

  /**
   * Validate promotion for a cart
   */
  async validatePromotion(promotionId: string, cartData: {
    userId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
  }): Promise<ServiceResult<PromotionValidation>> {
    try {
      const cacheKey = `promotion:validate:${promotionId}:${cartData.userId}:${cartData.subtotal}`;
      const cached = await cache.get<PromotionValidation>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Find promotion by id
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: promotionId }
      });

      if (!promotion) {
        return {
          success: true,
          data: {
            isValid: false,
            reason: 'Invalid promotion'
          }
        };
      }

      // Check status
      if (!promotion.isActive) {
        return {
          success: true,
          data: {
            isValid: false,
            reason: 'Promotion is not active'
          }
        };
      }

      // Check dates
      const now = new Date();
      if (now < promotion.validFrom || now > promotion.validTo) {
        return {
          success: true,
          data: {
            isValid: false,
            reason: 'Promotion is not valid at this time'
          }
        };
      }

      // Note: Usage limits would require additional fields in the Promotion model
      // For now, we'll skip usage limit validation

      // Note: Minimum purchase amount would require additional fields in the Promotion model
      // For now, we'll skip minimum purchase validation

      // Note: User and membership targeting would require additional fields in the Promotion model
      // For now, we'll skip user targeting validation

      // Calculate discount for all items (simplified validation)
      let discountAmount = 0;

      if (promotion.type === 'PERCENTAGE') {
        discountAmount = cartData.subtotal * (parseFloat(promotion.value.toString()) / 100);
      } else if (promotion.type === 'FIXED_AMOUNT') {
        discountAmount = Math.min(parseFloat(promotion.value.toString()), cartData.subtotal);
      }

      const validation: PromotionValidation = {
        isValid: true,
        applicableProducts: cartData.items.map(i => i.productId),
        discountAmount: Math.round(discountAmount * 100) / 100
      };

      await cache.set(cacheKey, validation, { ttl: 300 });
      return { success: true, data: validation };
    } catch (error) {
      this.logger.error({ error, promotionId }, 'Failed to validate promotion');
      return {
        success: false,
        error: new ApiError('Failed to validate promotion', 500, 'VALIDATE_PROMOTION_ERROR')
      };
    }
  }


  /**
   * Get active promotions
   */
  async getActivePromotions(options: {
    page?: number;
    limit?: number;
  } = {}): Promise<ServiceResult<PaginatedResult<Promotion>>> {
    try {
      const now = new Date();
      const where: Prisma.PromotionWhereInput = {
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now }
      };

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const [promotions, total] = await Promise.all([
        this.prisma.promotion.findMany({
          where,
          orderBy: [
            { priority: 'desc' },
            { value: 'desc' }
          ],
          skip,
          take: limit
        }),
        this.prisma.promotion.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: promotions,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get active promotions');
      return {
        success: false,
        error: new ApiError('Failed to get promotions', 500, 'GET_PROMOTIONS_ERROR')
      };
    }
  }

  /**
   * Get promotion statistics
   */
  async getPromotionStats(promotionId: string): Promise<ServiceResult<PromotionStats>> {
    try {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: promotionId }
      });

      if (!promotion) {
        return {
          success: false,
          error: new ApiError('Promotion not found', 404, 'PROMOTION_NOT_FOUND')
        };
      }

      // Get usage data
      const usages = await this.prisma.couponUse.findMany({
        where: { couponId: promotionId }
      });

      // Calculate stats (simplified without order data)
      const totalUsage = usages.length;
      const totalDiscountGiven = usages.reduce((sum, use) => sum + parseFloat(use.discount.toString()), 0);
      const uniqueUsers = new Set(usages.map(u => u.userId)).size;
      const averageOrderValue = 0; // Would need order data
      const conversionRate = 0; // Would need view/impression data

      // Simplified stats without detailed product breakdown
      const topProducts: Array<{
        productId: string;
        productName: string;
        usageCount: number;
        totalDiscount: number;
      }> = [];

      // Calculate daily usage
      const dailyUsageMap = new Map<string, { count: number; discount: number }>();
      
      usages.forEach(use => {
        const dateKey = use.usedAt.toISOString().split('T')[0];
        const current = dailyUsageMap.get(dateKey) || { count: 0, discount: 0 };
        current.count++;
        current.discount += parseFloat(use.discount.toString());
        dailyUsageMap.set(dateKey, current);
      });

      const dailyUsage = Array.from(dailyUsageMap.entries())
        .map(([date, data]) => ({
          date: new Date(date),
          usageCount: data.count,
          discountAmount: Math.round(data.discount * 100) / 100
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const stats: PromotionStats = {
        totalUsage,
        totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
        uniqueUsers,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        topProducts,
        dailyUsage
      };

      return { success: true, data: stats };
    } catch (error) {
      this.logger.error({ error, promotionId }, 'Failed to get promotion stats');
      return {
        success: false,
        error: new ApiError('Failed to get promotion stats', 500, 'PROMOTION_STATS_ERROR')
      };
    }
  }


  /**
   * Deactivate expired promotions
   */
  async deactivateExpiredPromotions(): Promise<ServiceResult<{ deactivatedCount: number }>> {
    try {
      const now = new Date();
      const result = await this.prisma.promotion.updateMany({
        where: {
          isActive: true,
          validTo: { lt: now }
        },
        data: {
          isActive: false
        }
      });

      if (result.count > 0) {
        await cache.invalidatePattern('promotions:*');
        this.logger.info({ count: result.count }, 'Deactivated expired promotions');
      }

      return {
        success: true,
        data: { deactivatedCount: result.count }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to deactivate expired promotions');
      return {
        success: false,
        error: new ApiError('Failed to deactivate promotions', 500, 'DEACTIVATE_ERROR')
      };
    }
  }
}
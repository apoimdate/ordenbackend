import { FastifyInstance } from 'fastify';
import { Prisma, Coupon, CouponStatus } from '@prisma/client';
import { ServiceResult, CreateCouponData, UpdateCouponData, CouponWithDetails, ValidateCouponData, ApplyCouponData, CreateFlashSaleData, FlashSaleWithDetails, CouponAnalyticsData } from '../types';
import { logger } from '../utils/logger';
import { CrudService } from './crud.service';
import { ApiError } from '../utils/errors';
import { Redis } from 'ioredis';

export class CouponService extends CrudService<Coupon> {
  modelName = 'coupon' as const;
  private redis: Redis;

  constructor(fastify: FastifyInstance) {
    super(fastify);
    this.redis = fastify.redis;
  }

  // Coupon Management

  async createCoupon(data: CreateCouponData): Promise<ServiceResult<CouponWithDetails>> {
    try {
      // Validate coupon code uniqueness
      const existingCoupon = await this.prisma.coupon.findUnique({
        where: { code: data.code.toUpperCase() }
      });

      if (existingCoupon) {
        throw new ApiError('Coupon code already exists', 409);
      }

      // Validate dates
      if (data.validFrom && data.validTo && data.validFrom >= data.validTo) {
        throw new ApiError('Valid from date must be before valid to date', 400);
      }

      // Validate discount value based on type
      if ((data as any).discountType === 'PERCENTAGE' && ((data as any).discountValue <= 0 || (data as any).discountValue > 100)) {
        throw new ApiError('Percentage discount must be between 1 and 100', 400);
      }

      if ((data as any).discountType === 'FIXED_AMOUNT' && (data as any).discountValue <= 0) {
        throw new ApiError('Fixed amount discount must be greater than 0', 400);
      }

      // Create coupon
      const coupon = await this.prisma.coupon.create({
        data: {
          ...data,
          code: data.code.toUpperCase(),
          usageCount: 0,
          status: 'ACTIVE'
        } as any
      });

      // Clear cache
      await this.redis.del('coupons:active');
      await this.redis.del(`coupon:${coupon.code}`);

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'coupon_created',
          userId: data.createdBy,
          data: {
            eventCategory: 'promotion',
            eventAction: 'create',
            eventLabel: coupon.code,
            couponId: coupon.id,
            discountType: coupon.type,
            discountValue: coupon.value
          }
        }
      });

      logger.info({
        couponId: coupon.id,
        code: coupon.code,
        createdBy: data.createdBy
      }, 'Coupon created successfully');

      return {
        success: true,
        data: {
          ...coupon,
          applicableProducts: [],
          applicableCategories: [],
          usages: []
        } as CouponWithDetails
      };
    } catch (error) {
      logger.error({ error, data }, 'Error creating coupon');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_CREATION_FAILED',
          message: 'Failed to create coupon',
          statusCode: 500
        }
      };
    }
  }

  async updateCoupon(couponId: string, data: UpdateCouponData): Promise<ServiceResult<CouponWithDetails>> {
    try {
      // Check if coupon exists
      const existingCoupon = await this.prisma.coupon.findUnique({
        where: { id: couponId }
      });

      if (!existingCoupon) {
        throw new ApiError('Coupon not found', 404);
      }

      // If updating code, check uniqueness
      if (data.code && data.code.toUpperCase() !== existingCoupon.code) {
        const codeExists = await this.prisma.coupon.findUnique({
          where: { code: data.code.toUpperCase() }
        });

        if (codeExists) {
          throw new ApiError('Coupon code already exists', 409);
        }
      }

      // Update coupon
      const updateData: any = { ...data };
      if (updateData.code) {
        updateData.code = updateData.code.toUpperCase();
      }

      const coupon = await this.prisma.coupon.update({
        where: { id: couponId },
        data: updateData,
        include: {
          uses: true
        }
      });

      // Clear cache
      await this.redis.del('coupons:active');
      await this.redis.del(`coupon:${existingCoupon.code}`);
      if (data.code) {
        await this.redis.del(`coupon:${data.code.toUpperCase()}`);
      }

      logger.info({
        couponId: coupon.id,
        code: coupon.code
      }, 'Coupon updated successfully');

      return {
        success: true,
        data: {
          ...coupon,
          applicableProducts: [],
          applicableCategories: [],
          usages: []
        } as CouponWithDetails
      };
    } catch (error) {
      logger.error({ error, couponId, data }, 'Error updating coupon');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_UPDATE_FAILED',
          message: 'Failed to update coupon',
          statusCode: 500
        }
      };
    }
  }

  async deleteCoupon(couponId: string): Promise<ServiceResult<void>> {
    try {
      const coupon = await this.prisma.coupon.findUnique({
        where: { id: couponId }
      });

      if (!coupon) {
        throw new ApiError('Coupon not found', 404);
      }

      // Check if coupon has been used
      const usageCount = await this.prisma.couponUse.count({
        where: { couponId }
      });

      if (usageCount > 0) {
        // Soft delete - deactivate instead of deleting
        await this.prisma.coupon.update({
          where: { id: couponId },
          data: { status: 'INACTIVE' }
        });
      } else {
        // Hard delete if never used
        await this.prisma.coupon.delete({
          where: { id: couponId }
        });
      }

      // Clear cache
      await this.redis.del('coupons:active');
      await this.redis.del(`coupon:${coupon.code}`);

      logger.info({
        couponId,
        code: coupon.code,
        hadUsage: usageCount > 0
      }, 'Coupon deleted successfully');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      logger.error({ error, couponId }, 'Error deleting coupon');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_DELETION_FAILED',
          message: 'Failed to delete coupon',
          statusCode: 500
        }
      };
    }
  }

  async getCoupon(couponId: string): Promise<ServiceResult<CouponWithDetails>> {
    try {
      const coupon = await this.prisma.coupon.findUnique({
        where: { id: couponId },
        include: {
          uses: {
            orderBy: { usedAt: 'desc' }
          }
        }
      });

      if (!coupon) {
        throw new ApiError('Coupon not found', 404);
      }

      return {
        success: true,
        data: {
          ...coupon,
          applicableProducts: [],
          applicableCategories: [],
          usages: coupon.uses ? coupon.uses.map(use => ({
            ...use,
            user: { email: '', firstName: '', lastName: '' }
          })) : []
        } as CouponWithDetails
      };
    } catch (error) {
      logger.error({ error, couponId }, 'Error getting coupon');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_FETCH_FAILED',
          message: 'Failed to fetch coupon',
          statusCode: 500
        }
      };
    }
  }

  async getCouponByCode(code: string): Promise<ServiceResult<CouponWithDetails>> {
    try {
      // Try cache first
      const cached = await this.redis.get(`coupon:${code.toUpperCase()}`);
      if (cached) {
        return {
          success: true,
          data: JSON.parse(cached)
        };
      }

      const coupon = await this.prisma.coupon.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (!coupon) {
        throw new ApiError('Coupon not found', 404);
      }

      // Cache for 5 minutes
      await this.redis.setex(`coupon:${code.toUpperCase()}`, 300, JSON.stringify(coupon));

      return {
        success: true,
        data: coupon as any
      };
    } catch (error) {
      logger.error({ error, code }, 'Error getting coupon by code');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_FETCH_FAILED',
          message: 'Failed to fetch coupon',
          statusCode: 500
        }
      };
    }
  }

  // Coupon Validation and Application

  async validateCoupon(data: ValidateCouponData): Promise<ServiceResult<any>> {
    try {
      const couponResult = await this.getCouponByCode(data.code);
      if (!couponResult.success) {
        return couponResult;
      }

      const coupon = couponResult.data!;

      // Check if coupon is active
      if (coupon.status !== CouponStatus.ACTIVE) {
        throw new ApiError('Coupon is not active', 400);
      }

      // Check date validity
      const now = new Date();
      if (coupon.validFrom && now < coupon.validFrom) {
        throw new ApiError('Coupon is not yet valid', 400);
      }

      if (coupon.validTo && now > coupon.validTo) {
        throw new ApiError('Coupon has expired', 400);
      }

      // Check usage limits
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new ApiError('Coupon usage limit reached', 400);
      }

      // Check user-specific usage limit
      if (data.userId && coupon.userLimit) {
        const userUsageCount = await this.prisma.couponUse.count({
          where: {
            couponId: coupon.id,
            userId: data.userId
          }
        });

        if (userUsageCount >= coupon.userLimit) {
          throw new ApiError('User has reached the usage limit for this coupon', 400);
        }
      }

      // Check minimum order amount
      if (coupon.minimumPurchase && data.orderAmount < Number(coupon.minimumPurchase)) {
        throw new ApiError(`Minimum order amount of ${coupon.minimumPurchase} required`, 400);
      }

      // Check currency compatibility
      if ((coupon as any).currency && data.currency && (coupon as any).currency !== data.currency) {
        throw new ApiError('Coupon currency does not match order currency', 400);
      }

      // Check product/category applicability
      if (data.productIds && (coupon.productIds.length > 0 || coupon.categoryIds.length > 0)) {
        const isApplicable = await this.checkCouponApplicability(coupon, data.productIds);
        if (!isApplicable) {
          throw new ApiError('Coupon is not applicable to the items in your cart', 400);
        }
      }

      // Calculate discount
      const discountCalculation = await this.calculateDiscount(coupon, data);

      return {
        success: true,
        data: {
          valid: true,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.type,
            discountValue: coupon.value
          },
          discount: discountCalculation
        }
      };
    } catch (error) {
      logger.error({ error, data }, 'Error validating coupon');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_VALIDATION_FAILED',
          message: 'Failed to validate coupon',
          statusCode: 500
        }
      };
    }
  }

  async applyCoupon(data: ApplyCouponData): Promise<ServiceResult<any>> {
    try {
      // First validate the coupon
      const validationResult = await this.validateCoupon({
        code: data.code,
        userId: data.userId,
        orderAmount: data.orderAmount,
        currency: data.currency,
        productIds: data.productIds
      });

      if (!validationResult.success) {
        return validationResult;
      }

      const { coupon, discount } = validationResult.data!;

      // Create coupon usage record
      const usage = await this.prisma.couponUse.create({
        data: {
          couponId: coupon.id,
          userId: data.userId,
          orderId: data.orderId,
          discount: discount.amount
        }
      });

      // Update coupon usage count
      await this.prisma.coupon.update({
        where: { id: coupon.id },
        data: {
          usageCount: {
            increment: 1
          }
        }
      });

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'coupon_used',
          userId: data.userId,
          data: {
            eventCategory: 'promotion',
            eventAction: 'apply',
            eventLabel: coupon.code,
            orderId: data.orderId,
            value: discount.amount,
            currency: data.currency,
            couponId: coupon.id,
            discountAmount: discount.amount,
            originalAmount: data.orderAmount
          }
        }
      });

      // Clear cache
      await this.redis.del(`coupon:${coupon.code}`);

      logger.info({
        couponId: coupon.id,
        code: coupon.code,
        userId: data.userId,
        orderId: data.orderId,
        discountAmount: discount.amount
      }, 'Coupon applied successfully');

      return {
        success: true,
        data: {
          usage,
          discount,
          appliedCoupon: coupon
        }
      };
    } catch (error) {
      logger.error({ error, data }, 'Error applying coupon');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'COUPON_APPLICATION_FAILED',
          message: 'Failed to apply coupon',
          statusCode: 500
        }
      };
    }
  }

  // Flash Sales Management

  async createFlashSale(data: CreateFlashSaleData): Promise<ServiceResult<FlashSaleWithDetails>> {
    try {
      // Validate dates
      if (data.startTime >= data.endTime) {
        throw new ApiError('Start time must be before end time', 400);
      }

      if (data.startTime <= new Date()) {
        throw new ApiError('Start time must be in the future', 400);
      }

      // Check for overlapping flash sales on same products
      const overlappingProducts = await this.prisma.flashSale.findMany({
        where: {
          // status: 'ACTIVE', // Field doesn't exist in FlashSale model
          OR: [
            {
              startsAt: { lte: data.endTime },
              endsAt: { gte: data.startTime }
            }
          ],
          items: {
            some: {
              productId: {
                in: data.productIds
              }
            }
          }
        }
      });

      if (overlappingProducts.length > 0) {
        throw new ApiError('Some products already have overlapping flash sales', 409);
      }

      // Create flash sale
      const flashSale = await this.prisma.flashSale.create({
        data: {
          name: data.name,
          description: data.description,
          startsAt: data.startTime,
          endsAt: data.endTime,
          isActive: true,
          items: {
            create: data.productIds.map(productId => ({ productId }))
          } as any
        },
        include: {
          items: {
            // include: {
            //   product: {
            //     select: {
            //       id: true,
            //       name: true,
            //       price: true,
            //       images: true
            //     }
            //   }
            // }
          },
          // purchases: {
          //   include: {
          //     user: {
          //       select: {
          //         email: true,
          //         firstName: true,
          //         lastName: true
          //       }
          //     }
          //   }
          // }
        }
      });

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'flash_sale_created',
          userId: data.createdBy,
          data: {
            eventCategory: 'promotion',
            eventAction: 'create',
            eventLabel: flashSale.name,
            flashSaleId: flashSale.id,
            discountPercentage: data.discountPercentage,
            productCount: data.productIds.length
          }
        }
      });

      logger.info({
        flashSaleId: flashSale.id,
        name: flashSale.name,
        createdBy: data.createdBy
      }, 'Flash sale created successfully');

      return {
        success: true,
        data: flashSale as any
      };
    } catch (error) {
      logger.error({ error, data }, 'Error creating flash sale');
      if (error instanceof ApiError) {
        return { success: false, error: { code: error.code, message: error.message, statusCode: error.statusCode } };
      }
      return {
        success: false,
        error: {
          code: 'FLASH_SALE_CREATION_FAILED',
          message: 'Failed to create flash sale',
          statusCode: 500
        }
      };
    }
  }

  async getActiveFlashSales(): Promise<ServiceResult<FlashSaleWithDetails[]>> {
    try {
      const now = new Date();
      
      const flashSales = await this.prisma.flashSale.findMany({
        where: {
          // status: 'ACTIVE', // Field doesn't exist in FlashSale model
          startsAt: { lte: now },
          endsAt: { gte: now }
        },
        include: {
          items: {
            // include: {
            //   product: {
            //     select: {
            //       id: true,
            //       name: true,
            //       price: true,
            //       images: true,
            //       stock: true
            //     }
            //   }
            // }
          }
        },
        orderBy: { startsAt: 'asc' }
      });

      return {
        success: true,
        data: flashSales as any
      };
    } catch (error) {
      logger.error({ error }, 'Error getting active flash sales');
      return {
        success: false,
        error: {
          code: 'FLASH_SALES_FETCH_FAILED',
          message: 'Failed to fetch active flash sales',
          statusCode: 500
        }
      };
    }
  }

  // PlatformAnalytics and Reporting

  async getCouponAnalytics(dateRange?: { startDate: Date; endDate: Date }): Promise<ServiceResult<CouponAnalyticsData>> {
    try {
      const where: Prisma.CouponWhereInput = dateRange ? {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      } : {};

      const [
        totalCoupons,
        activeCoupons,
        totalUsages,
        totalDiscountGiven,
        topCoupons,
        usageTrends
      ] = await this.prisma.$transaction([
        this.prisma.coupon.count({ where }),
        this.prisma.coupon.count({
          where: {
            ...where,
            status: 'ACTIVE',
            OR: [
              { validTo: null as any },
              { validTo: { gte: new Date() } }
            ]
          }
        }),
        this.prisma.couponUse.count({
          where: dateRange ? {
            usedAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate
            }
          } : {}
        }),
        this.prisma.couponUse.aggregate({
          where: dateRange ? {
            usedAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate
            }
          } : {},
          _sum: { discount: true }
        }),
        this.prisma.coupon.findMany({
          where,
          select: {
            id: true,
            code: true,
            description: true,
            usageCount: true,
            type: true,
            value: true
          },
          orderBy: { usageCount: 'desc' },
          take: 10
        }),
        this.prisma.$queryRaw<Array<{ date: Date; usage_count: BigInt; total_discount: number }>>`
          SELECT
            DATE_TRUNC('day', "usedAt") as date,
            COUNT(*) as usage_count,
            SUM("discount") as total_discount
          FROM "coupon_uses"
          WHERE "usedAt" >= ${dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
            AND "usedAt" <= ${dateRange?.endDate || new Date()}
          GROUP BY DATE_TRUNC('day', "usedAt")
          ORDER BY date ASC
        `
      ]);

      return {
        success: true,
        data: {
          totalCoupons,
          activeCoupons,
          totalUsages,
          totalDiscountGiven: Number(totalDiscountGiven._sum.discount || 0),
          topCoupons: topCoupons.map(c => ({
            id: c.id,
            code: c.code,
            description: c.description || undefined,
            usageCount: c.usageCount,
            discountType: String(c.type),
            discountValue: Number(c.value)
          })),
          usageTrends: usageTrends.map(t => ({ ...t, usage_count: Number(t.usage_count) })),
          averageDiscountPerUsage: totalUsages > 0 ?
            Number(totalDiscountGiven._sum.discount || 0) / totalUsages : 0
        }
      };
    } catch (error) {
      logger.error({ error }, 'Error getting coupon analytics');
      return {
        success: false,
        error: {
          code: 'ANALYTICS_FETCH_FAILED',
          message: 'Failed to fetch coupon analytics',
          statusCode: 500
        }
      };
    }
  }

  private async checkCouponApplicability(coupon: Coupon, productIds: string[]): Promise<boolean> {
    // If no restrictions, applicable to all products
    if (coupon.productIds.length === 0 && coupon.categoryIds.length === 0) {
      return true;
    }

    // Check direct product applicability
    if (coupon.productIds.some((id: string) => productIds.includes(id))) {
      return true;
    }

    // Check category applicability
    if (coupon.categoryIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { categoryId: true }
      });

      const productCategoryIds = products.map((p: any) => p.categoryId).filter(Boolean);

      if (coupon.categoryIds.some((id: string) => productCategoryIds.includes(id))) {
        return true;
      }
    }

    return false;
  }

  private async calculateDiscount(coupon: Coupon, data: ValidateCouponData): Promise<any> {
    let discountAmount = 0;

    if (coupon.type === 'PERCENTAGE') {
      discountAmount = (data.orderAmount * coupon.value.toNumber()) / 100;
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discountAmount = coupon.value.toNumber();
    }

    // Apply maximum discount limit
    if ((coupon as any).maxDiscountAmount && discountAmount > (coupon as any).maxDiscountAmount.toNumber()) {
      discountAmount = (coupon as any).maxDiscountAmount.toNumber();
    }

    // Ensure discount doesn't exceed order amount
    if (discountAmount > data.orderAmount) {
      discountAmount = data.orderAmount;
    }

    return {
      amount: discountAmount,
      percentage: coupon.type === 'PERCENTAGE' ? coupon.value.toNumber() :
        (discountAmount / data.orderAmount) * 100,
      finalAmount: data.orderAmount - discountAmount
    };
  }
}
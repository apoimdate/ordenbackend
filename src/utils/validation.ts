import { PrismaClient } from '@prisma/client';
import { ApiError } from './errors';

/**
 * PRODUCTION: Comprehensive validation utilities for FK constraints and enum validation
 * Provides centralized validation logic for data integrity across the application
 */

export class ValidationService {
  constructor(private prisma: PrismaClient) {}

  // Foreign Key Validation Methods

  async validateUserId(userId: string, throwOnError = true): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user && throwOnError) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    return !!user;
  }

  async validateSellerId(sellerId: string, throwOnError = true): Promise<boolean> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId }
    });

    if (!seller && throwOnError) {
      throw new ApiError('Seller not found', 404, 'SELLER_NOT_FOUND');
    }

    return !!seller;
  }

  async validateProductId(productId: string, throwOnError = true): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product && throwOnError) {
      throw new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    return !!product;
  }

  async validateProductVariantId(variantId: string, productId?: string, throwOnError = true): Promise<boolean> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    if (!variant && throwOnError) {
      throw new ApiError('Product variant not found', 404, 'VARIANT_NOT_FOUND');
    }

    // If productId is provided, validate that the variant belongs to the product
    if (variant && productId && variant.productId !== productId) {
      if (throwOnError) {
        throw new ApiError(
          `Product variant ${variantId} does not belong to product ${productId}`,
          400,
          'INVALID_PRODUCT_VARIANT'
        );
      }
      return false;
    }

    return !!variant;
  }

  async validateCategoryId(categoryId: string, throwOnError = true): Promise<boolean> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category && throwOnError) {
      throw new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    return !!category;
  }

  async validateBrandId(brandId: string, throwOnError = true): Promise<boolean> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand && throwOnError) {
      throw new ApiError('Brand not found', 404, 'BRAND_NOT_FOUND');
    }

    return !!brand;
  }

  async validateOrderId(orderId: string, throwOnError = true): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order && throwOnError) {
      throw new ApiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    return !!order;
  }

  async validateAddressId(addressId: string, userId?: string, throwOnError = true): Promise<boolean> {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId }
    });

    if (!address && throwOnError) {
      throw new ApiError('Address not found', 404, 'ADDRESS_NOT_FOUND');
    }

    // If userId is provided, validate that the address belongs to the user
    if (address && userId && address.userId !== userId) {
      if (throwOnError) {
        throw new ApiError('Address does not belong to the user', 403, 'INVALID_ADDRESS_OWNER');
      }
      return false;
    }

    return !!address;
  }

  async validatePickupLocationId(locationId: string, throwOnError = true): Promise<boolean> {
    const location = await this.prisma.pickupLocation.findUnique({
      where: { id: locationId }
    });

    if (!location && throwOnError) {
      throw new ApiError('Pickup location not found', 404, 'PICKUP_LOCATION_NOT_FOUND');
    }

    return !!location;
  }

  async validateCouponCode(code: string, throwOnError = true): Promise<boolean> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code }
    });

    if (!coupon && throwOnError) {
      throw new ApiError('Invalid coupon code', 400, 'INVALID_COUPON');
    }

    // Check if coupon is active and not expired
    if (coupon) {
      const now = new Date();
      
      if (coupon.status !== 'ACTIVE') {
        if (throwOnError) {
          throw new ApiError('Coupon is not active', 400, 'COUPON_INACTIVE');
        }
        return false;
      }

      if (coupon.validFrom && coupon.validFrom > now) {
        if (throwOnError) {
          throw new ApiError('Coupon is not yet valid', 400, 'COUPON_NOT_YET_VALID');
        }
        return false;
      }

      if (coupon.validTo && coupon.validTo < now) {
        if (throwOnError) {
          throw new ApiError('Coupon has expired', 400, 'COUPON_EXPIRED');
        }
        return false;
      }

      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        if (throwOnError) {
          throw new ApiError('Coupon usage limit reached', 400, 'COUPON_LIMIT_REACHED');
        }
        return false;
      }
    }

    return !!coupon;
  }

  async validateShipmentId(shipmentId: string, throwOnError = true): Promise<boolean> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId }
    });

    if (!shipment && throwOnError) {
      throw new ApiError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
    }

    return !!shipment;
  }

  async validateStockLocationId(locationId: string, throwOnError = true): Promise<boolean> {
    const location = await this.prisma.stock_locations.findUnique({
      where: { id: locationId }
    });

    if (!location && throwOnError) {
      throw new ApiError('Stock location not found', 404, 'STOCK_LOCATION_NOT_FOUND');
    }

    return !!location;
  }

  async validateMembershipId(membershipId: string, throwOnError = true): Promise<boolean> {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId }
    });

    if (!membership && throwOnError) {
      throw new ApiError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
    }

    return !!membership;
  }

  async validateReviewId(reviewId: string, throwOnError = true): Promise<boolean> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review && throwOnError) {
      throw new ApiError('Review not found', 404, 'REVIEW_NOT_FOUND');
    }

    return !!review;
  }

  async validatePaymentId(paymentId: string, throwOnError = true): Promise<boolean> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment && throwOnError) {
      throw new ApiError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    return !!payment;
  }

  // Batch validation for performance
  async validateMultiple(validations: Array<{
    type: 'user' | 'seller' | 'product' | 'order' | 'category' | 'brand' | 'address' | 'payment';
    id: string;
    additionalData?: any;
  }>): Promise<Array<{ id: string; valid: boolean; error?: string }>> {
    const results = await Promise.all(
      validations.map(async (validation) => {
        try {
          let valid = false;
          switch (validation.type) {
            case 'user':
              valid = await this.validateUserId(validation.id, false);
              break;
            case 'seller':
              valid = await this.validateSellerId(validation.id, false);
              break;
            case 'product':
              valid = await this.validateProductId(validation.id, false);
              break;
            case 'order':
              valid = await this.validateOrderId(validation.id, false);
              break;
            case 'category':
              valid = await this.validateCategoryId(validation.id, false);
              break;
            case 'brand':
              valid = await this.validateBrandId(validation.id, false);
              break;
            case 'address':
              valid = await this.validateAddressId(
                validation.id,
                validation.additionalData?.userId,
                false
              );
              break;
            case 'payment':
              valid = await this.validatePaymentId(validation.id, false);
              break;
          }
          return { id: validation.id, valid };
        } catch (error: any) {
          return { id: validation.id, valid: false, error: error.message };
        }
      })
    );

    return results;
  }

  // Cascade validation helpers
  async canDeleteUser(userId: string): Promise<{ canDelete: boolean; reason?: string }> {
    // Check for active orders
    const activeOrders = await this.prisma.order.count({
      where: {
        userId,
        status: {
          in: ['PENDING', 'PROCESSING', 'SHIPPED']
        }
      }
    });

    if (activeOrders > 0) {
      return { canDelete: false, reason: 'User has active orders' };
    }

    // Check for active seller account
    const seller = await this.prisma.seller.findFirst({
      where: { userId, status: 'APPROVED' }
    });

    if (seller) {
      return { canDelete: false, reason: 'User has an active seller account' };
    }

    return { canDelete: true };
  }

  async canDeleteProduct(productId: string): Promise<{ canDelete: boolean; reason?: string }> {
    // Check for active orders
    const activeOrders = await this.prisma.orderItem.count({
      where: {
        productId,
        order: {
          status: {
            in: ['PENDING', 'PROCESSING', 'SHIPPED']
          }
        }
      }
    });

    if (activeOrders > 0) {
      return { canDelete: false, reason: 'Product has active orders' };
    }

    // Check for inventory reservations
    const reservations = await this.prisma.inventory_reservations.count({
      where: { product_id: productId }
    });

    if (reservations > 0) {
      return { canDelete: false, reason: 'Product has inventory reservations' };
    }

    return { canDelete: true };
  }

  async canDeleteCategory(categoryId: string): Promise<{ canDelete: boolean; reason?: string }> {
    // Check for products
    const productCount = await this.prisma.product.count({
      where: { categoryId }
    });

    if (productCount > 0) {
      return { canDelete: false, reason: 'Category contains products' };
    }

    // Check for subcategories
    const subcategoryCount = await this.prisma.category.count({
      where: { parentId: categoryId }
    });

    if (subcategoryCount > 0) {
      return { canDelete: false, reason: 'Category has subcategories' };
    }

    return { canDelete: true };
  }

  // Enum validation helpers
  isValidOrderStatus(status: string): boolean {
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    return validStatuses.includes(status);
  }

  isValidPaymentStatus(status: string): boolean {
    const validStatuses = ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIAL_REFUND'];
    return validStatuses.includes(status);
  }

  isValidProductStatus(status: string): boolean {
    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    return validStatuses.includes(status);
  }

  isValidShippingMethod(method: string): boolean {
    const validMethods = ['STANDARD', 'EXPRESS', 'PICKUP'];
    return validMethods.includes(method);
  }

  isValidCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'MXN'];
    return validCurrencies.includes(currency);
  }

  isValidReviewStatus(status: string): boolean {
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    return validStatuses.includes(status);
  }

  isValidRefundStatus(status: string): boolean {
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'];
    return validStatuses.includes(status);
  }

  isValidShipmentStatus(status: string): boolean {
    const validStatuses = ['PENDING', 'PICKED', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    return validStatuses.includes(status);
  }

  // Complex validation scenarios
  async validateOrderItems(items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    price?: number;
  }>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const item of items) {
      // Validate product
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        errors.push(`Product ${item.productId} not found`);
        continue;
      }

      if (product.status !== 'PUBLISHED') {
        errors.push(`Product ${product.name} is not available`);
      }

      // Validate variant if provided
      if (item.variantId) {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId }
        });

        if (!variant) {
          errors.push(`Product variant ${item.variantId} not found`);
        } else if (variant.productId !== item.productId) {
          errors.push(`Variant ${item.variantId} does not belong to product ${item.productId}`);
        }
      }

      // Validate quantity
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for product ${product.name}`);
      }

      // Check stock if tracking inventory
      if (product.trackInventory) {
        const inventoryItem = await this.prisma.inventory_items.findFirst({
          where: { product_id: item.productId }
        });

        if (!inventoryItem) {
          errors.push(`No inventory found for product ${product.name}`);
        } else {
          // Check available quantity
          const reservations = await this.prisma.inventory_reservations.aggregate({
            where: { product_id: item.productId },
            _sum: { quantity: true }
          });

          const reservedQuantity = reservations._sum.quantity || 0;
          const availableQuantity = inventoryItem.quantity - reservedQuantity;

          if (item.quantity > availableQuantity) {
            errors.push(`Insufficient stock for ${product.name}. Available: ${availableQuantity}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validatePaymentData(data: {
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
  }): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate order
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId }
    });

    if (!order) {
      errors.push('Order not found');
    } else {
      // Check order status
      if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
        errors.push(`Cannot process payment for ${order.status} order`);
      }

      // Check if already paid
      if (order.paymentStatus === 'PAID') {
        errors.push('Order is already paid');
      }

      // Validate amount matches order total
      if (Math.abs(parseFloat(order.totalAmount.toString()) - data.amount) > 0.01) {
        errors.push('Payment amount does not match order total');
      }

      // Validate currency matches order currency
      if (order.currency !== data.currency) {
        errors.push('Payment currency does not match order currency');
      }
    }

    // Validate payment method
    const validPaymentMethods = ['card', 'bank_transfer', 'cash', 'crypto'];
    if (!validPaymentMethods.includes(data.paymentMethod)) {
      errors.push('Invalid payment method');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const validationService = (prisma: PrismaClient) => new ValidationService(prisma);
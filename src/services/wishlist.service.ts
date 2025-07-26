import { Wishlist } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';
import { nanoid } from 'nanoid';
import { WishlistRepository, ProductRepository } from '../repositories';

interface WishlistItemWithProduct extends Wishlist {
  product: {
    id: string;
    name: string;
    price: number;
    images: Array<{ url: string; isPrimary: boolean }>;
    status: string;
    seller: {
      id: string;
      businessName: string;
    };
    category?: {
      id: string;
      name: string;
    };
    brand?: {
      id: string;
      name: string;
    };
  };
}

interface WishlistResponse {
  userId: string;
  items: WishlistItemWithProduct[];
  itemCount: number;
}

export class WishlistService extends CrudService<Wishlist> {
  private wishlistRepo: WishlistRepository;
  private productRepo: ProductRepository;
  modelName = 'wishlist' as const;

  constructor(app: FastifyInstance) {
    super(app);
    this.wishlistRepo = new WishlistRepository(app.prisma, app.redis, this.logger);
    this.productRepo = new ProductRepository(app.prisma, app.redis, this.logger);
  }

  /**
   * Get user's wishlist with product details
   */
  async getUserWishlist(userId: string): Promise<ServiceResult<WishlistResponse>> {
    try {
      const cacheKey = `wishlist:user:${userId}`;
      const cached = await cache.get<WishlistResponse>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const wishlistItems = await this.wishlistRepo.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true }
              },
              seller: {
                select: {
                  id: true,
                  businessName: true
                }
              },
              category: {
                select: {
                  id: true,
                  name: true
                }
              },
              brand: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const response: WishlistResponse = {
        userId,
        items: wishlistItems as WishlistItemWithProduct[],
        itemCount: wishlistItems.length
      };

      await cache.set(cacheKey, response, { ttl: 300 });
      return { success: true, data: response };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user wishlist');
      return {
        success: false,
        error: new ApiError('Failed to get wishlist', 500, 'WISHLIST_ERROR')
      };
    }
  }

  /**
   * Add product to wishlist
   */
  async addToWishlist(userId: string, productId: string): Promise<ServiceResult<WishlistItemWithProduct>> {
    try {
      // Validate product exists and is active
      const product = await this.productRepo.findById(productId);
      if (!product) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      if (product.status !== 'PUBLISHED') {
        return {
          success: false,
          error: new ApiError('Product is not available', 400, 'PRODUCT_UNAVAILABLE')
        };
      }

      // Check if product already in wishlist
      const existingItem = await this.wishlistRepo.findFirst({
        where: {
          userId,
          productId
        }
      });

      if (existingItem) {
        return {
          success: false,
          error: new ApiError('Product already in wishlist', 400, 'ALREADY_IN_WISHLIST')
        };
      }

      // Add product to wishlist
      const wishlistItem = await this.prisma.wishlist.create({
        data: {
          id: nanoid(),
          userId,
          productId
        }
      });

      // Get full item with product details
      const fullItem = await this.wishlistRepo.findUnique({
        where: { id: wishlistItem.id },
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true }
              },
              seller: {
                select: {
                  id: true,
                  businessName: true
                }
              },
              category: {
                select: {
                  id: true,
                  name: true
                }
              },
              brand: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      // Clear cache
      await cache.invalidatePattern(`wishlist:user:${userId}:*`);

      // Emit event
      this.app.events?.emit('wishlist.item.added', {
        userId,
        productId,
        wishlistItemId: wishlistItem.id
      });

      return {
        success: true,
        data: fullItem as WishlistItemWithProduct
      };
    } catch (error) {
      this.logger.error({ error, userId, productId }, 'Failed to add to wishlist');
      return {
        success: false,
        error: new ApiError('Failed to add to wishlist', 500, 'WISHLIST_ADD_ERROR')
      };
    }
  }

  /**
   * Remove product from wishlist
   */
  async removeFromWishlist(userId: string, productId: string): Promise<ServiceResult<void>> {
    try {
      const wishlistItem = await this.wishlistRepo.findFirst({
        where: {
          userId,
          productId
        }
      });

      if (!wishlistItem) {
        return {
          success: false,
          error: new ApiError('Product not in wishlist', 404, 'ITEM_NOT_FOUND')
        };
      }

      await this.wishlistRepo.delete(wishlistItem.id);

      // Clear cache
      await cache.invalidatePattern(`wishlist:user:${userId}:*`);

      // Emit event
      this.app.events?.emit('wishlist.item.removed', {
        userId,
        productId
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error({ error, userId, productId }, 'Failed to remove from wishlist');
      return {
        success: false,
        error: new ApiError('Failed to remove from wishlist', 500, 'WISHLIST_REMOVE_ERROR')
      };
    }
  }

  /**
   * Clear entire wishlist
   */
  async clearWishlist(userId: string): Promise<ServiceResult<{ deletedCount: number }>> {
    try {
      const result = await this.wishlistRepo.deleteMany({
        userId
      });

      // Clear cache
      await cache.invalidatePattern(`wishlist:user:${userId}:*`);

      // Emit event
      this.app.events?.emit('wishlist.cleared', {
        userId,
        deletedCount: result.count
      });

      return { success: true, data: { deletedCount: result.count } };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to clear wishlist');
      return {
        success: false,
        error: new ApiError('Failed to clear wishlist', 500, 'WISHLIST_CLEAR_ERROR')
      };
    }
  }

  /**
   * Check if product is in wishlist
   */
  async isInWishlist(userId: string, productId: string): Promise<ServiceResult<boolean>> {
    try {
      const cacheKey = `wishlist:check:${userId}:${productId}`;
      const cached = await cache.get<boolean>(cacheKey);
      if (cached !== null) {
        return { success: true, data: cached };
      }

      const exists = await this.wishlistRepo.findFirst({
        where: {
          userId,
          productId
        }
      });

      const result = !!exists;
      await cache.set(cacheKey, result, { ttl: 300 });
      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error, userId, productId }, 'Failed to check wishlist');
      return {
        success: false,
        error: new ApiError('Failed to check wishlist', 500, 'WISHLIST_CHECK_ERROR')
      };
    }
  }

  /**
   * Get wishlist statistics
   */
  async getWishlistStats(userId: string): Promise<ServiceResult<{
    totalItems: number;
    totalValue: number;
    categories: Array<{ categoryId: string; categoryName: string; count: number }>;
    brands: Array<{ brandId: string; brandName: string; count: number }>;
    priceRanges: {
      under50: number;
      range50to100: number;
      range100to500: number;
      above500: number;
    };
  }>> {
    try {
      const wishlistItems = await this.prisma.wishlist.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              category: true,
              brand: true
            }
          }
        }
      });

      if (wishlistItems.length === 0) {
        return {
          success: true,
          data: {
            totalItems: 0,
            totalValue: 0,
            categories: [],
            brands: [],
            priceRanges: {
              under50: 0,
              range50to100: 0,
              range100to500: 0,
              above500: 0
            }
          }
        };
      }

      // Calculate statistics
      let totalValue = 0;
      const categoryMap = new Map<string, { name: string; count: number }>();
      const brandMap = new Map<string, { name: string; count: number }>();
      const priceRanges = {
        under50: 0,
        range50to100: 0,
        range100to500: 0,
        above500: 0
      };

      wishlistItems.forEach(item => {
        const price = parseFloat(item.product.price.toString());
        totalValue += price;

        // Category stats
        if (item.product.category) {
          const catData = categoryMap.get(item.product.categoryId || '') || { 
            name: item.product.category.name, 
            count: 0 
          };
          catData.count++;
          categoryMap.set(item.product.categoryId || '', catData);
        }

        // Brand stats
        if (item.product.brand) {
          const brandData = brandMap.get(item.product.brandId!) || { 
            name: item.product.brand.name, 
            count: 0 
          };
          brandData.count++;
          brandMap.set(item.product.brandId!, brandData);
        }

        // Price range stats
        if (price < 50) priceRanges.under50++;
        else if (price < 100) priceRanges.range50to100++;
        else if (price < 500) priceRanges.range100to500++;
        else priceRanges.above500++;
      });

      return {
        success: true,
        data: {
          totalItems: wishlistItems.length,
          totalValue: Math.round(totalValue * 100) / 100,
          categories: Array.from(categoryMap.entries()).map(([id, data]) => ({
            categoryId: id,
            categoryName: data.name,
            count: data.count
          })),
          brands: Array.from(brandMap.entries()).map(([id, data]) => ({
            brandId: id,
            brandName: data.name,
            count: data.count
          })),
          priceRanges
        }
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get wishlist stats');
      return {
        success: false,
        error: new ApiError('Failed to get wishlist statistics', 500, 'WISHLIST_STATS_ERROR')
      };
    }
  }

  /**
   * Move all wishlist items to cart
   */
  async moveAllToCart(userId: string): Promise<ServiceResult<{ movedCount: number; failedCount: number }>> {
    try {
      const wishlistItems = await this.prisma.wishlist.findMany({
        where: { userId },
        include: {
          product: true
        }
      });

      if (wishlistItems.length === 0) {
        return {
          success: true,
          data: { movedCount: 0, failedCount: 0 }
        };
      }

      let movedCount = 0;
      let failedCount = 0;

      // Get or create cart
      let cart = await this.prisma.cart.findFirst({
        where: { userId }
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: {
            id: nanoid(),
            userId
          }
        });
      }

      // Move each item to cart
      for (const item of wishlistItems) {
        try {
          // Check if product is available
          if (item.product.status !== 'PUBLISHED') {
            failedCount++;
            continue;
          }

          // Check if already in cart
          const existingCartItem = await this.prisma.cartItem.findFirst({
            where: {
              cartId: cart.id,
              productId: item.productId
            }
          });

          if (!existingCartItem) {
            await this.prisma.cartItem.create({
              data: {
                id: nanoid(),
                cartId: cart.id,
                productId: item.productId,
                quantity: 1,
                price: item.product?.price || 0
              }
            });
            movedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          this.logger.warn({ error, productId: item.productId }, 'Failed to move item to cart');
          failedCount++;
        }
      }

      // Clear wishlist after moving
      if (movedCount > 0) {
        await this.wishlistRepo.deleteMany({
          userId
        });
      }

      // Clear caches
      await cache.invalidatePattern(`wishlist:user:${userId}:*`);
      await cache.invalidatePattern(`cart:${userId}:*`);

      return {
        success: true,
        data: { movedCount, failedCount }
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to move wishlist to cart');
      return {
        success: false,
        error: new ApiError('Failed to move items to cart', 500, 'WISHLIST_MOVE_ERROR')
      };
    }
  }
}
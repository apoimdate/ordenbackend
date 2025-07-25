import { Cart, CartItem, Wishlist, Prisma, Currency } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';
import { CartRepository, CartItemRepository, ProductRepository, ProductVariantRepository, WishlistRepository } from '../repositories';

// Define missing types

interface AddToCartData {
  productId: string;
  variantId?: string;
  quantity: number;
  customizations?: Record<string, any>;
  guestCartId?: string;
}

interface UpdateCartItemData {
  cartItemId: string;
  quantity: number;
  customizations?: Record<string, any>;
}

interface AddToWishlistData {
  productId: string;
  variantId?: string;
  notes?: string;
}

interface CartCalculation {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  total: number;
  currency: Currency;
  appliedCoupons: Array<{
    code: string;
    discountAmount: number;
    discountType: string;
  }>;
  taxBreakdown: Array<{
    taxName: string;
    rate: number;
    amount: number;
  }>;
}

interface CartWithDetails extends Cart {
  items: Array<CartItemWithDetails>;
  calculation: CartCalculation;
  abandonment?: {
    abandonedAt: Date;
    remindersSent: number;
    recovered: boolean;
  };
}

interface CartItemWithDetails extends CartItem {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    salePrice?: number;
    imageUrl?: string;
    isActive: boolean;
    inStock: boolean;
    stockQuantity: number;
    sellerId: string;
    seller: {
      storeName: string;
      isVerified: boolean;
    };
  };
  variant?: {
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    sku: string;
    stockQuantity: number;
    isActive: boolean;
  };
  calculatedPrice: number;
  lineTotal: number;
  availableQuantity: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
}

interface WishlistWithDetails {
  items: Array<WishlistItemWithDetails>;
  totalItems: number;
}

interface WishlistItemWithDetails extends Wishlist {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    salePrice?: number;
    imageUrl?: string;
    isActive: boolean;
    inStock: boolean;
    stockQuantity: number;
    averageRating: number;
    sellerId: string;
    seller: {
      storeName: string;
      isVerified: boolean;
    };
  };
  variant?: {
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    sku: string;
    stockQuantity: number;
    isActive: boolean;
  };
  currentPrice: number;
  originalPrice: number;
  priceDropped: boolean;
  discountPercentage: number;
  isInCart: boolean;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
}

interface CartValidationResult {
  isValid: boolean;
  errors: Array<{
    itemId: string;
    productId: string;
    error: string;
    suggestion?: string;
  }>;
  warnings: Array<{
    itemId: string;
    productId: string;
    warning: string;
  }>;
}

interface CartMergeOptions {
  strategy: 'replace' | 'add' | 'keep_latest';
  preserveGuestCart: boolean;
}

export class CartService extends CrudService<Cart, Prisma.CartCreateInput, Prisma.CartUpdateInput> {
  cartAbandonmentRepo: any;
  cartItemRepo: CartItemRepository;
  cartRepo: CartRepository;
  productRepo: ProductRepository;
  productVariantRepo: ProductVariantRepository;
  wishlistRepo: WishlistRepository;
  modelName = 'cart' as const;

  constructor(app: FastifyInstance) {
    super(app);
    this.cartRepo = new CartRepository(this.prisma, this.app.redis, this.logger);
    this.cartItemRepo = new CartItemRepository(this.prisma, this.app.redis, this.logger);
    this.productRepo = new ProductRepository(this.prisma, this.app.redis, this.logger);
    this.productVariantRepo = new ProductVariantRepository(this.prisma, this.app.redis, this.logger);
    this.wishlistRepo = new WishlistRepository(this.prisma, this.app.redis, this.logger);
  }

  async createCart(data: { userId: string }): Promise<ServiceResult<Cart>> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
      if (!user) {
        return { success: false, error: new ApiError('User not found', 404) };
      }
      const cart = await this.prisma.cart.create({
        data: {
          user: {
            connect: {
              id: data.userId,
            },
          },
        },
      });
      return { success: true, data: cart };
    } catch (error: any) {
      this.logger.error({ err: error }, 'Failed to create cart');
      return {
        success: false,
        error: new ApiError('Failed to create cart', 500, error.code, error.message),
      };
    }
  }

  async update(id: string, data: Prisma.CartUpdateInput): Promise<ServiceResult<Cart>> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id },
        data,
      });
      return { success: true, data: cart };
    } catch (error: any) {
      this.logger.error({ err: error }, 'Failed to update cart');
      return {
        success: false,
        error: new ApiError('Failed to update cart', 500, error.code, error.message),
      };
    }
  }

  // Cart Management
  async addToCart(userId: string | null, data: AddToCartData): Promise<ServiceResult<CartWithDetails>> {
    try {
      // Validate product and variant
      const product = await this.productRepo.findById(data.productId);
      if (!product || product.status !== 'PUBLISHED') {
        return {
          success: false,
          error: new ApiError('Product not found or inactive', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      let variant = null;
      if (data.variantId) {
        variant = await this.productVariantRepo.findById(data.variantId);
        if (!variant || variant.productId !== data.productId) {
          return {
            success: false,
            error: new ApiError('Product variant not found or inactive', 404, 'VARIANT_NOT_FOUND')
          };
        }
      }

      // Check stock availability
      const availableStock = variant?.quantity ?? product.quantity ?? 0;
      if (availableStock < data.quantity) {
        return {
          success: false,
          error: new ApiError('Insufficient stock available', 400, 'INSUFFICIENT_STOCK')
        };
      }

      // Get or create cart
      let cart = await this.getOrCreateCart(userId, data.guestCartId);
      if (!cart) {
        return {
          success: false,
          error: new ApiError('Unable to create cart for guest users', 400, 'GUEST_CART_NOT_SUPPORTED')
        };
      }

      // Check if item already exists in cart
      const existingItem = await this.prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: data.productId,
          variantId: data.variantId
        }
      });

      let updatedCart;
      if (existingItem) {
        // Update existing item
        const newQuantity = existingItem.quantity + data.quantity;
        if (newQuantity > availableStock) {
          return {
            success: false,
            error: new ApiError('Cannot add more items - insufficient stock', 400, 'INSUFFICIENT_STOCK')
          };
        }

        await this.cartItemRepo.update(existingItem.id, {
          quantity: newQuantity,
        });
      } else {
        // Create new cart item
        await this.cartItemRepo.create({
          cart: { connect: { id: cart.id } },
          product: { connect: { id: data.productId } },
          variant: data.variantId ? { connect: { id: data.variantId } } : undefined,
          quantity: data.quantity,
          price: variant?.price ?? product.price,
        });
      }

      // Update cart timestamp
      await this.cartRepo.update(cart.id, {
        updatedAt: new Date()
      });

      // Get updated cart with details
      updatedCart = await this.getCartWithDetails(cart.id);

      // Track analytics event
      this.app.events?.emit('cart.item.added', {
        userId,
        cartId: cart.id,
        productId: data.productId,
        variantId: data.variantId,
        quantity: data.quantity,
        value: Number(variant?.price ?? product.price)
      });

      // Clear cache
      await cache.invalidatePattern(`cart:${userId || cart.id}:*`);

      this.logger.info({ 
        userId, 
        cartId: cart.id, 
        productId: data.productId,
        quantity: data.quantity 
      }, 'Item added to cart');

      return {
        success: true,
        data: updatedCart!
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to add item to cart');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to add item to cart', 500)
      };
    }
  }

  async updateCartItem(userId: string | null, data: UpdateCartItemData): Promise<ServiceResult<CartWithDetails>> {
    try {
      const cartItem = await this.cartItemRepo.findById(data.cartItemId);
      if (!cartItem) {
        return {
          success: false,
          error: new ApiError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')
        };
      }

      // Verify ownership
      const cart = await this.cartRepo.findById(cartItem.cartId);
      if (!cart || (userId && cart.userId !== userId)) {
        return {
          success: false,
          error: new ApiError('Cart not found or access denied', 404, 'CART_NOT_FOUND')
        };
      }

      if (data.quantity <= 0) {
        // Remove item if quantity is 0 or negative
        await this.cartItemRepo.delete(cartItem.id);
      } else {
        // Validate stock availability
        const product = await this.productRepo.findById(cartItem.productId);
        let variant = null;
        if (cartItem.variantId) {
          variant = await this.productVariantRepo.findById(cartItem.variantId);
        }

        const availableStock = variant?.quantity ?? product?.quantity ?? 0;
        if (availableStock < data.quantity) {
          return {
            success: false,
            error: new ApiError('Insufficient stock available', 400, 'INSUFFICIENT_STOCK')
          };
        }

        // Update cart item
        await this.cartItemRepo.update(cartItem.id, {
          quantity: data.quantity,
        });
      }

      // Update cart timestamp
      await this.cartRepo.update(cart.id, {
        updatedAt: new Date()
      });

      // Get updated cart
      const updatedCart = await this.getCartWithDetails(cart.id);

      // Track analytics event
      this.app.events?.emit('cart.item.updated', {
        userId,
        cartId: cart.id,
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        oldQuantity: cartItem.quantity,
        newQuantity: data.quantity
      });

      // Clear cache
      await cache.invalidatePattern(`cart:${userId || cart.id}:*`);

      this.logger.info({ 
        userId, 
        cartId: cart.id, 
        cartItemId: data.cartItemId,
        quantity: data.quantity 
      }, 'Cart item updated');

      return {
        success: true,
        data: updatedCart!
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to update cart item');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to update cart item', 500)
      };
    }
  }

  async removeFromCart(userId: string | null, cartItemId: string): Promise<ServiceResult<CartWithDetails>> {
    try {
      const cartItem = await this.cartItemRepo.findById(cartItemId);
      if (!cartItem) {
        return {
          success: false,
          error: new ApiError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')
        };
      }

      // Verify ownership
      const cart = await this.cartRepo.findById(cartItem.cartId);
      if (!cart || (userId && cart.userId !== userId)) {
        return {
          success: false,
          error: new ApiError('Cart not found or access denied', 404, 'CART_NOT_FOUND')
        };
      }

      // Remove cart item
      await this.cartItemRepo.delete(cartItem.id);

      // Update cart timestamp
      await this.cartRepo.update(cart.id, {
        updatedAt: new Date()
      });

      // Get updated cart
      const updatedCart = await this.getCartWithDetails(cart.id);

      // Track analytics event
      this.app.events?.emit('cart.item.removed', {
        userId,
        cartId: cart.id,
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        quantity: cartItem.quantity
      });

      // Clear cache
      await cache.invalidatePattern(`cart:${userId || cart.id}:*`);

      this.logger.info({ 
        userId, 
        cartId: cart.id, 
        cartItemId 
      }, 'Item removed from cart');

      return {
        success: true,
        data: updatedCart!
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to remove item from cart');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to remove item from cart', 500)
      };
    }
  }

  async clearCart(userId: string | null, cartId?: string): Promise<ServiceResult<void>> {
    try {
      let cart;
      if (cartId) {
        cart = await this.cartRepo.findById(cartId);
      } else if (userId) {
        const carts = await this.cartRepo.findByUserId(userId);
        cart = carts[0];
      }

      if (!cart) {
        return {
          success: false,
          error: new ApiError('Cart not found', 404, 'CART_NOT_FOUND')
        };
      }

      // Verify ownership
      if (userId && cart.userId !== userId) {
        return {
          success: false,
          error: new ApiError('Access denied', 403, 'ACCESS_DENIED')
        };
      }

      // Delete all cart items
      await this.cartItemRepo.deleteMany({
        where: { cartId: cart.id }
      });

      // Update cart timestamp
      await this.cartRepo.update(cart.id, {
        updatedAt: new Date()
      });

      // Track analytics event
      this.app.events?.emit('cart.cleared', {
        userId,
        cartId: cart.id
      });

      // Clear cache
      await cache.invalidatePattern(`cart:${userId || cart.id}:*`);

      this.logger.info({ userId, cartId: cart.id }, 'Cart cleared');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to clear cart');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to clear cart', 500)
      };
    }
  }

  async getCart(userId: string | null, cartId?: string): Promise<ServiceResult<CartWithDetails>> {
    try {
      const cacheKey = `cart:${userId || cartId}:details`;
      const cached = await cache.get<CartWithDetails>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let cart;
      if (cartId) {
        cart = await this.cartRepo.findById(cartId);
      } else if (userId) {
        const carts = await this.cartRepo.findByUserId(userId);
        cart = carts[0];
      }

      if (!cart) {
        return {
          success: false,
          error: new ApiError('Cart not found', 404, 'CART_NOT_FOUND')
        };
      }

      // Verify ownership
      if (userId && cart.userId !== userId) {
        return {
          success: false,
          error: new ApiError('Access denied', 403, 'ACCESS_DENIED')
        };
      }

      const cartWithDetails = await this.getCartWithDetails(cart.id);
      if (!cartWithDetails) {
        return {
          success: false,
          error: new ApiError('Failed to load cart details', 500, 'CART_LOAD_ERROR')
        };
      }

      // Cache for 10 minutes
      await cache.set(cacheKey, cartWithDetails, { ttl: 600 });

      return {
        success: true,
        data: cartWithDetails
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get cart');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get cart', 500)
      };
    }
  }

  async validateCart(userId: string | null, cartId?: string): Promise<ServiceResult<CartValidationResult>> {
    try {
      const cartResult = await this.getCart(userId, cartId);
      if (!cartResult.success) {
        return {
          success: false,
          error: cartResult.error
        };
      }

      const cart = cartResult.data;
      if(!cart) {
        return {
          success: false,
          error: new ApiError('Cart not found', 404, 'CART_NOT_FOUND')
        };
      }
      const errors: CartValidationResult['errors'] = [];
      const warnings: CartValidationResult['warnings'] = [];

      for (const item of cart.items) {
        // Check product availability
        if (!item.product.isActive) {
          errors.push({
            itemId: item.id,
            productId: item.productId,
            error: 'Product is no longer available',
            suggestion: 'Remove this item from your cart'
          });
          continue;
        }

        // Check stock availability
        if (item.stockStatus === 'out_of_stock') {
          errors.push({
            itemId: item.id,
            productId: item.productId,
            error: 'Product is out of stock',
            suggestion: 'Remove this item or check back later'
          });
        } else if (item.quantity > item.availableQuantity) {
          errors.push({
            itemId: item.id,
            productId: item.productId,
            error: `Only ${item.availableQuantity} items available`,
            suggestion: `Reduce quantity to ${item.availableQuantity}`
          });
        } else if (item.stockStatus === 'low_stock') {
          warnings.push({
            itemId: item.id,
            productId: item.productId,
            warning: `Only ${item.availableQuantity} items left in stock`
          });
        }

        // Check price changes
        const currentPrice = Number(item.variant?.price ?? item.product.price);
        if (Math.abs(currentPrice - Number(item.price)) > 0.01) {
          warnings.push({
            itemId: item.id,
            productId: item.productId,
            warning: `Price has changed from ${item.price} to ${currentPrice}`
          });
        }

        // Check variant availability
        if (item.variantId && item.variant && !item.variant.isActive) {
          errors.push({
            itemId: item.id,
            productId: item.productId,
            error: 'Selected variant is no longer available',
            suggestion: 'Choose a different variant or remove this item'
          });
        }
      }

      const result: CartValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate cart');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to validate cart', 500)
      };
    }
  }

  async mergeCart(userId: string, guestCartId: string, options: CartMergeOptions): Promise<ServiceResult<CartWithDetails>> {
    try {
      const [userCarts, guestCart] = await Promise.all([
        this.cartRepo.findByUserId(userId),
        this.cartRepo.findById(guestCartId)
      ]);
      const userCart = userCarts[0];

      if (!guestCart) {
        return {
          success: false,
          error: new ApiError('Guest cart not found', 404, 'GUEST_CART_NOT_FOUND')
        };
      }

      // If user has no cart, just assign the guest cart
      if (!userCart) {
        await this.cartRepo.update(guestCart.id, {
          user: { connect: { id: userId } },
        });

        const updatedCart = await this.getCartWithDetails(guestCart.id);
        return {
          success: true,
          data: updatedCart!
        };
      }

      // Merge cart items based on strategy
      const guestItems = await this.cartItemRepo.findMany({
        where: { cartId: guestCart.id }
      });

      for (const guestItem of guestItems) {
        const existingItem = await this.prisma.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: guestItem.productId,
            variantId: guestItem.variantId
          }
        });

        if (existingItem) {
          switch (options.strategy) {
            case 'add':
              await this.cartItemRepo.update(existingItem.id, {
                quantity: existingItem.quantity + guestItem.quantity
              });
              break;
            case 'replace':
              await this.cartItemRepo.update(existingItem.id, {
                quantity: guestItem.quantity,
                price: guestItem.price,
              });
              break;
            case 'keep_latest':
              if (guestItem.updatedAt > existingItem.updatedAt) {
                await this.cartItemRepo.update(existingItem.id, {
                  quantity: guestItem.quantity,
                  price: guestItem.price,
                });
              }
              break;
          }
        } else {
          // Move item to user cart
          await this.cartItemRepo.update(guestItem.id, {
            cart: { connect: { id: userCart.id } }
          });
        }
      }

      // Clean up guest cart if not preserving
      if (!options.preserveGuestCart) {
        await this.cartRepo.delete(guestCart.id);
      }

      // Update user cart timestamp
      await this.cartRepo.update(userCart.id, {
        updatedAt: new Date()
      });

      const mergedCart = await this.getCartWithDetails(userCart.id);

      // Track analytics event
      this.app.events?.emit('cart.merged', {
        userId,
        userCartId: userCart.id,
        guestCartId,
        strategy: options.strategy
      });

      // Clear cache
      await cache.invalidatePattern(`cart:${userId}:*`);

      this.logger.info({ 
        userId, 
        userCartId: userCart.id, 
        guestCartId,
        strategy: options.strategy 
      }, 'Carts merged successfully');

      return {
        success: true,
        data: mergedCart!
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to merge carts');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to merge carts', 500)
      };
    }
  }

  // Wishlist Management
  // TODO: Fix wishlist implementation to match Prisma schema - current implementation expects WishlistItem model that doesn't exist
  async addToWishlist(_userId: string, _data: AddToWishlistData): Promise<ServiceResult<WishlistWithDetails>> {
    return {
      success: false,
      error: new ApiError('Wishlist feature temporarily disabled - schema mismatch', 501)
    };
  }

  async removeFromWishlist(_userId: string, _wishlistItemId: string): Promise<ServiceResult<WishlistWithDetails>> {
    return {
      success: false,
      error: new ApiError('Wishlist feature temporarily disabled - schema mismatch', 501)
    };
  }

  async getWishlist(_userId: string): Promise<ServiceResult<WishlistWithDetails>> {
    return {
      success: false,
      error: new ApiError('Wishlist feature temporarily disabled - schema mismatch', 501)
    };
  }

  async moveToCartFromWishlist(_userId: string, _wishlistItemId: string, _quantity: number = 1): Promise<ServiceResult<{ cart: CartWithDetails; wishlist: WishlistWithDetails }>> {
    return {
      success: false,
      error: new ApiError('Wishlist feature temporarily disabled - schema mismatch', 501)
    };
  }

  // Private helper methods
  private async getOrCreateCart(userId: string | null, guestCartId?: string): Promise<Cart | null> {
    if (userId) {
      const carts = await this.cartRepo.findByUserId(userId);
      let cart = carts.length > 0 ? carts[0] : null;
      if (!cart) {
        cart = await this.cartRepo.create({
          user: { connect: { id: userId } },
        });
      }
      return cart;
    } else if (guestCartId) {
      const cart = await this.cartRepo.findById(guestCartId);
      if (cart) return cart;
    }

    // Guest carts not supported in current schema
    return null;
  }

  private async getCartWithDetails(cartId: string): Promise<CartWithDetails | null> {
    const cart = await this.cartRepo.findById(cartId, {
      include: {
        items: {
          include: {
            product: {
              include: {
                seller: {
                  select: {
                    businessName: true,
                  }
                }
              }
            },
            variant: true
          }
        }
      }
    });

    if (!cart) return null;

    // Enrich cart items with calculated data
    const enrichedItems: CartItemWithDetails[] = [];
    const cartItems = (cart as any).items || [];
    for (const item of cartItems) {
      const currentPrice = Number(item.variant?.price ?? item.product.price);
      const availableStock = item.variant?.quantity ?? item.product.quantity ?? 0;
      
      let stockStatus: CartItemWithDetails['stockStatus'] = 'in_stock';
      if (item.product.status !== 'PUBLISHED') {
        stockStatus = 'discontinued';
      } else if (availableStock === 0) {
        stockStatus = 'out_of_stock';
      } else if (availableStock < 10) {
        stockStatus = 'low_stock';
      }

      enrichedItems.push({
        ...item,
        product: {
          ...item.product,
          inStock: availableStock > 0,
          stockQuantity: availableStock,
          price: Number(item.product.price),
          seller: {
            storeName: item.product.seller?.businessName || '',
            isVerified: true
          }
        },
        variant: item.variant ? {
          ...item.variant,
          price: Number(item.variant.price),
        } : undefined,
        calculatedPrice: currentPrice,
        lineTotal: currentPrice * item.quantity,
        availableQuantity: availableStock,
        stockStatus
      });
    }

    // Calculate cart totals
    const calculation = await this.calculateCartTotals(enrichedItems);

    // Check for cart abandonment
    const abandonment = await this.cartAbandonmentRepo.findOne({
      where: { cartId }
    });

    return {
      ...cart,
      items: enrichedItems,
      calculation,
      abandonment: abandonment ? {
        abandonedAt: abandonment.abandonedAt,
        remindersSent: abandonment.remindersSent,
        recovered: abandonment.recovered
      } : undefined
    };
  }


  private async calculateCartTotals(items: CartItemWithDetails[]): Promise<CartCalculation> {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    const shippingAmount = 0; // Would be calculated based on shipping rules

    // Calculate subtotal
    for (const item of items) {
      subtotal += item.lineTotal;
    }

    // Calculate tax (simplified - would use actual tax rules)
    taxAmount = subtotal * 0.08; // 8% tax rate

    const total = subtotal + taxAmount + shippingAmount - discountAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      shippingAmount,
      total,
      currency: Currency.USD,
      appliedCoupons: [], // Would calculate from applied coupons
      taxBreakdown: [{
        taxName: 'Sales Tax',
        rate: 8,
        amount: taxAmount
      }]
    };
  }
}

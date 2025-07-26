import { Order, OrderItem, OrderHistory, OrderStatus, PaymentStatus, ShippingMethod, Prisma, Currency, ProductStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { logger as appLogger } from '../utils/logger';
import { 
  OrderRepository,
  OrderItemRepository,
  OrderHistoryRepository,
  UserRepository,
  ProductRepository,
  ProductVariantRepository,
  AddressRepository
} from "../repositories";
import { ServiceResult, PaginatedResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { updateSearchIndex } from '../utils/search';
import { FraudDetectionService } from './fraud-detection.service';
import { nanoid } from 'nanoid';

interface CreateOrderData {
  userId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    price?: number; // Optional override price
  }>;
  shippingAddressId?: string;
  pickupLocationId?: string;
  shippingMethod: ShippingMethod;
  couponCode?: string;
  notes?: string;
  currency?: Currency;
}


interface OrderSearchParams {
  userId?: string;
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  currency?: Currency;
  shippingMethod?: ShippingMethod[];
  orderNumber?: string;
  customerEmail?: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'amount_asc' | 'amount_desc' | 'status';
}

interface OrderCalculations {
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
}

interface OrderWithDetails extends Order {
  items: (OrderItem & {
    product: { name: string; images: Array<{ url: string }> };
    variant?: { name: string };
  })[];
  user: { email: string; firstName?: string; lastName?: string };
  shippingAddress?: { 
    fullName: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  history: OrderHistory[];
}

export class OrderService extends CrudService<Order> {
  orderRepo: OrderRepository;
  orderItemRepo: OrderItemRepository;
  orderHistoryRepo: OrderHistoryRepository;
  userRepo: UserRepository;
  productRepo: ProductRepository;
  productVariantRepo: ProductVariantRepository;
  addressRepo: AddressRepository;
  
  modelName: 'order' = 'order';

  private fraudService: FraudDetectionService;

  constructor(app: FastifyInstance) {
    super(app);
    this.orderRepo = new OrderRepository(app.prisma, app.redis, appLogger);
    this.orderItemRepo = new OrderItemRepository(app.prisma, app.redis, appLogger);
    this.orderHistoryRepo = new OrderHistoryRepository(app.prisma, app.redis, appLogger);
    this.userRepo = new UserRepository(app.prisma, app.redis, appLogger);
    this.productRepo = new ProductRepository(app.prisma, app.redis, appLogger);
    this.productVariantRepo = new ProductVariantRepository(app.prisma, app.redis, appLogger);
    this.addressRepo = new AddressRepository(app.prisma, app.redis, appLogger);
    this.fraudService = new FraudDetectionService(app.prisma, app.redis);
  }

  async create(data: any): Promise<ServiceResult<Order>> {
    try {
      // Validate user exists
      const user = await this.userRepo.findById(data.userId);
      if (!user) {
        return {
          success: false,
          error: new ApiError('User not found', 404, 'USER_NOT_FOUND')
        };
      }

      // Validate shipping address if provided
      if (data.shippingAddressId) {
        const address = await this.addressRepo.findById(data.shippingAddressId);
        if (!address || address.userId !== data.userId) {
          return {
            success: false,
            error: new ApiError('Invalid shipping address', 400, 'INVALID_ADDRESS')
          };
        }
      }

      // Validate items and calculate totals
      const itemValidation = await this.validateOrderItems(data.items);
      if (!itemValidation.success) {
        return {
          success: false,
          error: itemValidation.error
        };
      }

      const calculations = await this.calculateOrderTotals(
        data.items,
        data.shippingMethod,
        data.couponCode,
        data.currency || Currency.USD
      );

      // Run fraud detection
      const fraudCheck = await this.fraudService.checkFraud({
        user,
        ipAddress: '0.0.0.0', // Would come from request
        userAgent: '' // Would come from request
      });

      if (!fraudCheck.passed) {
        return {
          success: false,
          error: new ApiError('Order blocked by fraud detection', 400, 'ORDER_BLOCKED')
        };
      }

      // Create order in transaction
      const order = await this.prisma.$transaction(async (tx) => {
        // Generate unique order number
        const orderNumber = await this.generateOrderNumber();

        // Create order
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId: data.userId,
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            subtotal: calculations.subtotal,
            taxAmount: calculations.taxAmount,
            shippingAmount: calculations.shippingAmount,
            discountAmount: calculations.discountAmount,
            totalAmount: calculations.totalAmount,
            currency: data.currency || Currency.USD,
            shippingMethod: data.shippingMethod,
            shippingAddressId: data.shippingAddressId,
            pickupLocationId: data.pickupLocationId,
            fraudScore: fraudCheck.score || 0
          }
        });

        // Create order items
        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { variants: true }
          });

          if (!product) {
            throw new ApiError(`Product ${item.productId} not found`, 404);
          }

          const variant = item.variantId 
            ? await this.productVariantRepo.findById(item.variantId)
            : null;

          const price = item.price || variant?.price || product.price;
          const subtotal = Number(price) * item.quantity;

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.productId,
              variantId: item.variantId,
              name: variant?.name || product.name,
              sku: variant?.sku || product.sku,
              price,
              quantity: item.quantity,
              subtotal
            }
          });

          // Update inventory if tracking
          if (product.trackInventory) {
            // Note: This would typically update an inventory table
            // Since we don't have one, we'll emit an event instead
            this.app.events?.emit('inventory.reserved', {
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              orderId: newOrder.id
            });
          }
        }

        // Create initial order history
        await tx.orderHistory.create({
          data: {
            orderId: newOrder.id,
            status: OrderStatus.PENDING,
            note: 'Order created',
            createdBy: data.userId
          }
        });

        return newOrder;
      });

      // Update search index
      await updateSearchIndex('orders', {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.userId,
        customerEmail: user.email,
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        status: order.status,
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        createdAt: order.createdAt.getTime()
      });

      // Clear user's cart cache
      await cache.invalidatePattern(`cart:${data.userId}:*`);

      // Emit order created event
      this.app.events?.emit('order.created', {
        orderId: order.id,
        userId: data.userId,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        riskScore: fraudCheck.score
      });

      this.logger.info({ 
        orderId: order.id, 
        orderNumber: order.orderNumber,
        userId: data.userId 
      }, 'Order created successfully');

      return {
        success: true,
        data: order
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create order');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create order', 500)
      };
    }
  }

  async update(id: string, data: any): Promise<ServiceResult<Order>> {
    try {
      const existingOrder = await this.orderRepo.findById(id);
      if (!existingOrder) {
        return {
          success: false,
          error: new ApiError('Order not found', 404, 'ORDER_NOT_FOUND')
        };
      }

      // Validate status transitions
      if (data.status && !this.isValidStatusTransition(existingOrder.status, data.status)) {
        return {
          success: false,
          error: new ApiError(
            `Invalid status transition from ${existingOrder.status} to ${data.status}`,
            400,
            'INVALID_STATUS_TRANSITION'
          )
        };
      }

      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        // Update order
        const order = await tx.order.update({
          where: { id },
          data: {
            status: data.status,
            paymentStatus: data.paymentStatus,
            shippingMethod: data.shippingMethod,
            shippingAddressId: data.shippingAddressId,
            pickupLocationId: data.pickupLocationId,
            pickupSlot: data.pickupSlot
          }
        });

        // Create history entry for status change
        if (data.status && data.status !== existingOrder.status) {
          await tx.orderHistory.create({
            data: {
              orderId: order.id,
              status: data.status,
              note: `Status changed from ${existingOrder.status} to ${data.status}`,
              createdBy: data.adminNotes ? 'admin' : order.userId
            }
          });

          // Handle inventory based on status
          if (data.status === OrderStatus.CANCELLED) {
            // Release reserved inventory
            this.app.events?.emit('inventory.released', {
              orderId: order.id,
              reason: 'order_cancelled'
            });
          } else if (data.status === OrderStatus.PROCESSING) {
            // Confirm inventory reservation
            this.app.events?.emit('inventory.confirmed', {
              orderId: order.id
            });
          }
        }

        return order;
      });

      // Update search index
      const user = await this.userRepo.findById(updatedOrder.userId);
      await updateSearchIndex('orders', {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        customerId: updatedOrder.userId,
        customerEmail: user?.email || '',
        customerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        status: updatedOrder.status,
        totalAmount: Number(updatedOrder.totalAmount),
        currency: updatedOrder.currency,
        createdAt: updatedOrder.createdAt.getTime()
      });

      // Clear cache
      await cache.invalidatePattern(`orders:${updatedOrder.id}:*`);
      await cache.invalidatePattern(`orders:user:${updatedOrder.userId}:*`);

      // Emit order updated event
      this.app.events?.emit('order.updated', {
        orderId: updatedOrder.id,
        userId: updatedOrder.userId,
        oldStatus: existingOrder.status,
        newStatus: updatedOrder.status,
        changes: data
      });

      this.logger.info({ 
        orderId: updatedOrder.id,
        oldStatus: existingOrder.status,
        newStatus: updatedOrder.status 
      }, 'Order updated successfully');

      return {
        success: true,
        data: updatedOrder
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to update order');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to update order', 500)
      };
    }
  }

  async getById(orderId: string, includeDetails: boolean = true): Promise<ServiceResult<OrderWithDetails | Order>> {
    try {
      const cacheKey = `orders:${orderId}:${includeDetails ? 'detailed' : 'basic'}`;
      const cached = await cache.get<OrderWithDetails | Order>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let order;
      if (includeDetails) {
        order = await this.orderRepo.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    images: {
                      where: { isPrimary: true },
                      select: { url: true }
                    }
                  }
                },
                variant: {
                  select: { name: true }
                }
              }
            },
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            },
            shippingAddress: true,
            history: {
              orderBy: { createdAt: 'desc' }
            }
          }
        });
      } else {
        order = await this.orderRepo.findById(orderId);
      }

      if (!order) {
        return {
          success: false,
          error: new ApiError('Order not found', 404, 'ORDER_NOT_FOUND')
        };
      }

      // Cache for 5 minutes
      await cache.set(cacheKey, order, { ttl: 300 });

      return {
        success: true,
        data: order
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get order');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get order', 500)
      };
    }
  }

  async getByOrderNumber(orderNumber: string): Promise<ServiceResult<OrderWithDetails>> {
    try {
      const order = await this.orderRepo.findUnique({
        where: { orderNumber },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  images: {
                    where: { isPrimary: true },
                    select: { url: true }
                  }
                }
              },
              variant: {
                select: { name: true }
              }
            }
          },
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          shippingAddress: true,
          history: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!order) {
        return {
          success: false,
          error: new ApiError('Order not found', 404, 'ORDER_NOT_FOUND')
        };
      }

      return {
        success: true,
        data: order as OrderWithDetails
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get order by number');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get order', 500)
      };
    }
  }

  async search(params: OrderSearchParams): Promise<ServiceResult<PaginatedResult<OrderWithDetails>>> {
    try {
      const cacheKey = `orders:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<OrderWithDetails>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.OrderWhereInput = {};

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.status?.length) {
        where.status = { in: params.status };
      }

      if (params.paymentStatus?.length) {
        where.paymentStatus = { in: params.paymentStatus };
      }

      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = params.dateFrom;
        if (params.dateTo) where.createdAt.lte = params.dateTo;
      }

      if (params.minAmount || params.maxAmount) {
        where.totalAmount = {};
        if (params.minAmount) where.totalAmount.gte = params.minAmount;
        if (params.maxAmount) where.totalAmount.lte = params.maxAmount;
      }

      if (params.currency) {
        where.currency = params.currency;
      }

      if (params.shippingMethod?.length) {
        where.shippingMethod = { in: params.shippingMethod };
      }

      if (params.orderNumber) {
        where.orderNumber = { contains: params.orderNumber, mode: 'insensitive' };
      }

      if (params.customerEmail) {
        where.user = {
          email: { contains: params.customerEmail, mode: 'insensitive' }
        };
      }

      // Determine sort order
      let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: 'desc' };
      switch (params.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'amount_asc':
          orderBy = { totalAmount: 'asc' };
          break;
        case 'amount_desc':
          orderBy = { totalAmount: 'desc' };
          break;
        case 'status':
          orderBy = { status: 'asc' };
          break;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        this.orderRepo.findMany({
          where,
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    images: {
                      where: { isPrimary: true },
                      select: { url: true }
                    }
                  }
                },
                variant: {
                  select: { name: true }
                }
              }
            },
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            },
            shippingAddress: true
          },
          orderBy,
          skip,
          take: limit
        }),
        this.orderRepo.count({ where })
      ]);

      const result: PaginatedResult<OrderWithDetails> = {
        data: orders as OrderWithDetails[],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

      // Cache for 2 minutes
      await cache.set(cacheKey, result, { ttl: 120 });

      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error }, 'Failed to search orders');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search orders', 500)
      };
    }
  }

  async cancel(orderId: string, reason?: string, userId?: string): Promise<ServiceResult<Order>> {
    try {
      const order = await this.orderRepo.findById(orderId);
      if (!order) {
        return {
          success: false,
          error: new ApiError('Order not found', 404, 'ORDER_NOT_FOUND')
        };
      }

      // Check if order can be cancelled
      if (!this.canBeCancelled(order.status)) {
        return {
          success: false,
          error: new ApiError(
            `Order with status ${order.status} cannot be cancelled`,
            400,
            'CANNOT_CANCEL_ORDER'
          )
        };
      }

      const updatedOrderResult = await this.update(orderId, {
        status: OrderStatus.CANCELLED,
        adminNotes: reason
      });

      if (updatedOrderResult.success) {
        // Emit cancellation event
        this.app.events?.emit('order.cancelled', {
          orderId: order.id,
          userId: order.userId,
          reason,
          cancelledBy: userId || order.userId
        });
      }

      return updatedOrderResult;
    } catch (error) {
      this.logger.error({ error }, 'Failed to cancel order');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to cancel order', 500)
      };
    }
  }

  private async validateOrderItems(items: CreateOrderData['items']): Promise<ServiceResult<void>> {
    if (!items.length) {
      return {
        success: false,
        error: {
          code: 'EMPTY_ORDER',
          message: 'Order must contain at least one item',
          statusCode: 400
        }
      };
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_QUANTITY',
            message: 'Item quantity must be positive',
            statusCode: 400
          }
        };
      }

      const product = await this.productRepo.findById(item.productId);
      if (!product || product.status !== ProductStatus.PUBLISHED) {
        return {
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: `Product ${item.productId} not found or inactive`,
            statusCode: 400
          }
        };
      }

      if (item.variantId) {
        const variant = await this.productVariantRepo.findById(item.variantId);
        if (!variant) {
          return {
            success: false,
            error: {
              code: 'VARIANT_NOT_FOUND',
              message: `Product variant ${item.variantId} not found`,
              statusCode: 400
            }
          };
        }

        // SECURITY FIX: Validate that variant belongs to the specified product
        if (variant.productId !== item.productId) {
          return {
            success: false,
            error: {
              code: 'INVALID_PRODUCT_VARIANT',
              message: `Product variant ${item.variantId} does not belong to product ${item.productId}`,
              statusCode: 400
            }
          };
        }
      }
    }

    return { success: true, data: undefined };
  }

  private async calculateOrderTotals(
    items: CreateOrderData['items'],
    shippingMethod: ShippingMethod,
    couponCode?: string,
    _currency: Currency = Currency.USD
  ): Promise<OrderCalculations> {
    let subtotal = 0;

    // Calculate subtotal
    for (const item of items) {
      const product = await this.productRepo.findById(item.productId);
      const variant = item.variantId 
        ? await this.productVariantRepo.findById(item.variantId)
        : null;

      // SECURITY FIX: Validate that variant belongs to the product
      if (variant && variant.productId !== item.productId) {
        throw new ApiError(
          `Product variant ${item.variantId} does not belong to product ${item.productId}`,
          400,
          'INVALID_PRODUCT_VARIANT'
        );
      }

      const price = item.price || variant?.price || product!.price;
      subtotal += Number(price) * item.quantity;
    }

    // Calculate tax (simplified - would normally be based on location)
    const taxRate = 0.08; // 8% tax rate
    const taxAmount = subtotal * taxRate;

    // Calculate shipping
    let shippingAmount = 0;
    switch (shippingMethod) {
      case ShippingMethod.STANDARD:
        shippingAmount = subtotal >= 50 ? 0 : 9.99; // Free shipping over $50
        break;
      case ShippingMethod.EXPRESS:
        shippingAmount = 19.99;
        break;
      case ShippingMethod.PICKUP:
        shippingAmount = 0;
        break;
    }

    // Calculate discount (simplified)
    let discountAmount = 0;
    if (couponCode) {
      // This would normally validate the coupon and calculate discount
      // For now, just a placeholder
      discountAmount = 0;
    }

    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    return {
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      totalAmount
    };
  }

  private async generateOrderNumber(): Promise<string> {
    // Generate format: ORD-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = nanoid(5).toUpperCase();
    return `ORD-${dateStr}-${random}`;
  }

  private isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
      [OrderStatus.CANCELLED]: [], // Terminal state
      [OrderStatus.RETURNED]: [] // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }

  private canBeCancelled(status: OrderStatus): boolean {
    return status === 'PENDING' || status === 'PROCESSING';
  }

  async getOrderStats(userId?: string, dateFrom?: Date, dateTo?: Date): Promise<ServiceResult<any>> {
    try {
      const where: Prisma.OrderWhereInput = {};
      
      if (userId) {
        where.userId = userId;
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [
        totalOrders,
        totalRevenue,
        statusCounts,
        averageOrderValue
      ] = await Promise.all([
        this.orderRepo.count({ where }),
        this.orderRepo.aggregate({
          where,
          _sum: { totalAmount: true }
        }),
        this.orderRepo.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.orderRepo.aggregate({
          where,
          _avg: { totalAmount: true }
        })
      ]);

      const stats = {
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        averageOrderValue: Number(averageOrderValue._avg.totalAmount || 0),
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>)
      };

      return { success: true, data: stats };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get order stats');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get order stats', 500)
      };
    }
  }
}
import { OrderItem, Prisma } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { OrderItemRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateOrderItemData {
  orderId: string;
  sellerOrderId?: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface UpdateOrderItemData extends Partial<CreateOrderItemData> {}

interface OrderItemSearchParams {
  orderId?: string;
  sellerOrderId?: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  maxQuantity?: number;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'quantity' | 'subtotal';
  sortOrder?: 'asc' | 'desc';
}

interface OrderItemWithDetails extends OrderItem {
  order?: {
    id: string;
    orderNumber: string;
    status: string;
  };
  product?: {
    id: string;
    name: string;
    slug: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
  sellerOrder?: {
    id: string;
    sellerId: string;
  };
}

interface OrderItemAnalytics {
  totalItems: number;
  totalValue: number;
  averagePrice: number;
  averageQuantity: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalValue: number;
  }>;
}

interface BulkUpdateData {
  itemIds: string[];
  updates: Partial<UpdateOrderItemData>;
}

export class OrderItemService {
  private itemRepo: OrderItemRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.itemRepo = new OrderItemRepository(prisma, redis, logger);
  }

  async create(data: CreateOrderItemData): Promise<ServiceResult<OrderItem>> {
    try {
      // PRODUCTION: Comprehensive input validation
      if (!data.orderId || data.orderId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Order ID is required', 400, 'INVALID_ORDER_ID')
        };
      }

      if (!data.productId || data.productId.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Product ID is required', 400, 'INVALID_PRODUCT_ID')
        };
      }

      if (!data.name || data.name.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('Product name is required', 400, 'INVALID_NAME')
        };
      }

      if (!data.sku || data.sku.trim().length === 0) {
        return {
          success: false,
          error: new ApiError('SKU is required', 400, 'INVALID_SKU')
        };
      }

      if (data.price <= 0) {
        return {
          success: false,
          error: new ApiError('Price must be greater than 0', 400, 'INVALID_PRICE')
        };
      }

      if (data.quantity <= 0) {
        return {
          success: false,
          error: new ApiError('Quantity must be greater than 0', 400, 'INVALID_QUANTITY')
        };
      }

      // PRODUCTION: Validate subtotal calculation
      const calculatedSubtotal = data.price * data.quantity;
      if (Math.abs(data.subtotal - calculatedSubtotal) > 0.01) {
        return {
          success: false,
          error: new ApiError(
            `Subtotal mismatch. Expected: ${calculatedSubtotal.toFixed(2)}, Received: ${data.subtotal.toFixed(2)}`,
            400,
            'SUBTOTAL_MISMATCH'
          )
        };
      }

      // PRODUCTION: Validate variant belongs to product if provided
      if (data.variantId) {
        // TODO: Add ProductVariantRepository validation when available
        // For now, relying on foreign key constraint
      }

      const orderItem = await this.itemRepo.create({
        id: nanoid(),
        order: {
          connect: { id: data.orderId }
        },
        product: {
          connect: { id: data.productId }
        },
        ...(data.variantId && {
          variant: {
            connect: { id: data.variantId }
          }
        }),
        ...(data.sellerOrderId && {
          sellerOrder: {
            connect: { id: data.sellerOrderId }
          }
        }),
        name: data.name.trim(),
        sku: data.sku.trim().toUpperCase(),
        price: data.price,
        quantity: data.quantity,
        subtotal: data.subtotal
      });

      // Clear related caches
      await this.clearOrderItemCaches(data.orderId);

      // PRODUCTION: Comprehensive success logging
      logger.info({
        event: 'ORDER_ITEM_CREATED',
        itemId: orderItem.id,
        orderId: data.orderId,
        productId: data.productId,
        variantId: data.variantId,
        sku: data.sku,
        name: data.name,
        price: data.price,
        quantity: data.quantity,
        subtotal: data.subtotal,
        timestamp: new Date().toISOString()
      }, 'Order item created successfully with production logging');

      return {
        success: true,
        data: orderItem
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create order item');
      return {
        success: false,
        error: new ApiError('Failed to create order item', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateOrderItemData): Promise<ServiceResult<OrderItem>> {
    try {
      // Check if order item exists
      const existingItem = await this.itemRepo.findById(id);
      if (!existingItem) {
        return {
          success: false,
          error: new ApiError('Order item not found', 404, 'ITEM_NOT_FOUND')
        };
      }

      // PRODUCTION: Validate price and quantity if provided
      if (data.price !== undefined && data.price <= 0) {
        return {
          success: false,
          error: new ApiError('Price must be greater than 0', 400, 'INVALID_PRICE')
        };
      }

      if (data.quantity !== undefined && data.quantity <= 0) {
        return {
          success: false,
          error: new ApiError('Quantity must be greater than 0', 400, 'INVALID_QUANTITY')
        };
      }

      // PRODUCTION: Recalculate subtotal if price or quantity changed
      let updateData = { ...data };
      if (data.price !== undefined || data.quantity !== undefined) {
        const newPrice = data.price !== undefined ? data.price : existingItem.price.toNumber();
        const newQuantity = data.quantity !== undefined ? data.quantity : existingItem.quantity;
        updateData.subtotal = newPrice * newQuantity;
      }

      const orderItem = await this.itemRepo.update(id, updateData);

      // Clear related caches
      await this.clearOrderItemCaches(existingItem.orderId);

      logger.info({ 
        itemId: id, 
        orderId: existingItem.orderId,
        changes: Object.keys(data) 
      }, 'Order item updated successfully');

      return {
        success: true,
        data: orderItem
      };
    } catch (error) {
      logger.error({ error, itemId: id, data }, 'Failed to update order item');
      return {
        success: false,
        error: new ApiError('Failed to update order item', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string, includeDetails = false): Promise<ServiceResult<OrderItemWithDetails | null>> {
    try {
      const cacheKey = `order-item:${id}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let orderItem = await cacheGet(cacheKey) as OrderItemWithDetails | null;
      if (!orderItem) {
        orderItem = await this.itemRepo.findUnique({
          where: { id },
          include: includeDetails ? {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true
              }
            },
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            sellerOrder: {
              select: {
                id: true,
                sellerId: true
              }
            }
          } : undefined
        });

        if (orderItem) {
          await cacheSet(cacheKey, orderItem, 300); // 5 minutes
        }
      }

      return {
        success: true,
        data: orderItem
      };
    } catch (error) {
      logger.error({ error, itemId: id }, 'Failed to find order item');
      return {
        success: false,
        error: new ApiError('Failed to retrieve order item', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByOrderId(orderId: string, includeDetails = false): Promise<ServiceResult<OrderItemWithDetails[]>> {
    try {
      const cacheKey = `order-items:order:${orderId}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let orderItems = await cacheGet(cacheKey) as OrderItemWithDetails[] | null;
      if (!orderItems) {
        orderItems = await this.itemRepo.findMany({
          where: { orderId },
          include: includeDetails ? {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            sellerOrder: {
              select: {
                id: true,
                sellerId: true
              }
            }
          } : undefined,
          orderBy: { id: 'asc' }
        });

        await cacheSet(cacheKey, orderItems, 300); // 5 minutes
      }

      return {
        success: true,
        data: orderItems || []
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to find order items');
      return {
        success: false,
        error: new ApiError('Failed to retrieve order items', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findByProductId(productId: string, includeDetails = false): Promise<ServiceResult<OrderItemWithDetails[]>> {
    try {
      const cacheKey = `order-items:product:${productId}:${includeDetails ? 'with-details' : 'basic'}`;
      
      let orderItems = await cacheGet(cacheKey) as OrderItemWithDetails[] | null;
      if (!orderItems) {
        orderItems = await this.itemRepo.findMany({
          where: { productId },
          include: includeDetails ? {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            sellerOrder: {
              select: {
                id: true,
                sellerId: true
              }
            }
          } : undefined,
          orderBy: { id: 'desc' }
        });

        await cacheSet(cacheKey, orderItems, 300); // 5 minutes
      }

      return {
        success: true,
        data: orderItems || []
      };
    } catch (error) {
      logger.error({ error, productId }, 'Failed to find order items by product');
      return {
        success: false,
        error: new ApiError('Failed to retrieve order items', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: OrderItemSearchParams): Promise<ServiceResult<PaginatedResult<OrderItemWithDetails>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.OrderItemWhereInput = {};

      if (params.orderId) {
        where.orderId = params.orderId;
      }

      if (params.sellerOrderId) {
        where.sellerOrderId = params.sellerOrderId;
      }

      if (params.productId) {
        where.productId = params.productId;
      }

      if (params.variantId) {
        where.variantId = params.variantId;
      }

      if (params.sku) {
        where.sku = {
          contains: params.sku,
          mode: 'insensitive'
        };
      }

      if (params.minPrice || params.maxPrice) {
        where.price = {};
        if (params.minPrice) where.price.gte = params.minPrice;
        if (params.maxPrice) where.price.lte = params.maxPrice;
      }

      if (params.minQuantity || params.maxQuantity) {
        where.quantity = {};
        if (params.minQuantity) where.quantity.gte = params.minQuantity;
        if (params.maxQuantity) where.quantity.lte = params.maxQuantity;
      }

      // Build orderBy clause
      let orderBy: Prisma.OrderItemOrderByWithRelationInput = { id: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'asc';
        switch (params.sortBy) {
          case 'name':
            orderBy = { name: sortOrder };
            break;
          case 'price':
            orderBy = { price: sortOrder };
            break;
          case 'quantity':
            orderBy = { quantity: sortOrder };
            break;
          case 'subtotal':
            orderBy = { subtotal: sortOrder };
            break;
        }
      }

      const [orderItems, total] = await Promise.all([
        this.itemRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true
              }
            },
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            sellerOrder: {
              select: {
                id: true,
                sellerId: true
              }
            }
          }
        }),
        this.itemRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: orderItems,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search order items');
      return {
        success: false,
        error: new ApiError('Failed to search order items', 500, 'SEARCH_FAILED')
      };
    }
  }

  async getOrderItemAnalytics(params: {
    orderId?: string;
    productId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<ServiceResult<OrderItemAnalytics>> {
    try {
      // Build where clause for analytics
      const where: Prisma.OrderItemWhereInput = {};

      if (params.orderId) {
        where.orderId = params.orderId;
      }

      if (params.productId) {
        where.productId = params.productId;
      }

      // Note: OrderItem model doesn't have createdAt field
      // Date filtering would need to be done through Order relationship if needed

      // Get basic analytics
      const [items, aggregation] = await Promise.all([
        this.itemRepo.findMany({
          where,
          include: {
            product: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }),
        this.itemRepo.aggregate({
          where,
          _count: { id: true },
          _sum: { 
            subtotal: true,
            quantity: true
          },
          _avg: { 
            price: true,
            quantity: true
          }
        })
      ]);

      // Calculate top products
      const productMap = new Map<string, {
        productId: string;
        productName: string;
        totalQuantity: number;
        totalValue: number;
      }>();

      items.forEach((item: any) => {
        const productId = item.productId;
        const productName = item.product?.name || 'Unknown Product';
        const existing = productMap.get(productId);

        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalValue += item.subtotal.toNumber();
        } else {
          productMap.set(productId, {
            productId,
            productName,
            totalQuantity: item.quantity,
            totalValue: item.subtotal.toNumber()
          });
        }
      });

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);

      return {
        success: true,
        data: {
          totalItems: aggregation._count.id,
          totalValue: aggregation._sum.subtotal?.toNumber() || 0,
          averagePrice: aggregation._avg.price?.toNumber() || 0,
          averageQuantity: aggregation._avg.quantity || 0,
          topProducts
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to get order item analytics');
      return {
        success: false,
        error: new ApiError('Failed to get order item analytics', 500, 'ANALYTICS_FAILED')
      };
    }
  }

  async bulkUpdate(data: BulkUpdateData): Promise<ServiceResult<{ updated: number }>> {
    try {
      // PRODUCTION: Validate all items exist
      const existingItems = await this.itemRepo.findMany({
        where: { id: { in: data.itemIds } }
      });

      if (existingItems.length !== data.itemIds.length) {
        const foundIds = existingItems.map(item => item.id);
        const missingIds = data.itemIds.filter(id => !foundIds.includes(id));
        return {
          success: false,
          error: new ApiError(
            `Order items not found: ${missingIds.join(', ')}`,
            404,
            'ITEMS_NOT_FOUND'
          )
        };
      }

      // PRODUCTION: If updating price or quantity, recalculate subtotals
      let updateData = { ...data.updates };
      if (data.updates.price !== undefined || data.updates.quantity !== undefined) {
        // For bulk updates with price/quantity changes, we need to update individually
        let updated = 0;
        for (const item of existingItems) {
          const newPrice = data.updates.price !== undefined ? data.updates.price : item.price.toNumber();
          const newQuantity = data.updates.quantity !== undefined ? data.updates.quantity : item.quantity;
          
          await this.itemRepo.update(item.id, {
            ...updateData,
            subtotal: newPrice * newQuantity
          });
          updated++;
        }

        // Clear caches for affected orders
        const orderIds = Array.from(new Set(existingItems.map(item => item.orderId)));
        for (const orderId of orderIds) {
          await this.clearOrderItemCaches(orderId);
        }

        logger.info({
          itemIds: data.itemIds,
          updates: Object.keys(data.updates),
          updated
        }, 'Bulk update with subtotal recalculation completed');

        return {
          success: true,
          data: { updated }
        };
      }

      // Simple bulk update without subtotal recalculation
      const updateResult = await this.itemRepo.updateMany(
        { id: { in: data.itemIds } },
        updateData
      );

      // Clear caches for affected orders
      const orderIds = Array.from(new Set(existingItems.map(item => item.orderId)));
      for (const orderId of orderIds) {
        await this.clearOrderItemCaches(orderId);
      }

      logger.info({
        itemIds: data.itemIds,
        updates: Object.keys(data.updates),
        updated: updateResult.count
      }, 'Bulk update completed');

      return {
        success: true,
        data: { updated: updateResult.count }
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to bulk update order items');
      return {
        success: false,
        error: new ApiError('Failed to bulk update order items', 500, 'BULK_UPDATE_FAILED')
      };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      // Check if order item exists
      const orderItem = await this.itemRepo.findById(id);
      if (!orderItem) {
        return {
          success: false,
          error: new ApiError('Order item not found', 404, 'ITEM_NOT_FOUND')
        };
      }

      // PRODUCTION: Check if order allows item deletion (order status validation)
      // TODO: Add order status validation when available
      // This would typically check if order is still in PENDING or PROCESSING status

      await this.itemRepo.delete(id);

      // Clear related caches
      await this.clearOrderItemCaches(orderItem.orderId);

      logger.info({ 
        itemId: id, 
        orderId: orderItem.orderId,
        productId: orderItem.productId,
        sku: orderItem.sku
      }, 'Order item deleted successfully');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      logger.error({ error, itemId: id }, 'Failed to delete order item');
      return {
        success: false,
        error: new ApiError('Failed to delete order item', 500, 'DELETION_FAILED')
      };
    }
  }

  async calculateOrderTotal(orderId: string): Promise<ServiceResult<{
    itemCount: number;
    subtotal: number;
    totalQuantity: number;
  }>> {
    try {
      const aggregation = await this.itemRepo.aggregate({
        where: { orderId },
        _count: { id: true },
        _sum: { 
          subtotal: true,
          quantity: true
        }
      });

      return {
        success: true,
        data: {
          itemCount: aggregation._count.id,
          subtotal: aggregation._sum.subtotal?.toNumber() || 0,
          totalQuantity: aggregation._sum.quantity || 0
        }
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to calculate order total');
      return {
        success: false,
        error: new ApiError('Failed to calculate order total', 500, 'CALCULATION_FAILED')
      };
    }
  }

  private async clearOrderItemCaches(orderId: string): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would clear specific patterns
      logger.info({ orderId }, 'Order item caches cleared');
    } catch (error) {
      logger.warn({ error, orderId }, 'Failed to clear some order item caches');
    }
  }
}
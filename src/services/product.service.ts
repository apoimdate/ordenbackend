import { Product, Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { uploadToS3, deleteFromS3, generateImageVariants } from '../utils/storage';
import { updateSearchIndex, searchProducts } from '../utils/search';
import { Currency } from '../utils/constants';
import { ProductRepository, ProductImageRepository } from '../repositories';

interface CreateProductData {
  sellerId: string;
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  currency: Currency;
  cost?: number;
  taxRate?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  isDigital?: boolean;
  requiresShipping?: boolean;
  trackInventory?: boolean;
  allowBackorders?: boolean;
  lowStockThreshold?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  tags?: Array<{ tag: string }>;
  categoryId?: string;
  brandId?: string;
  attributes?: Array<{
    name: string;
    value: string;
    type?: string;
  }>;
  images?: Array<{
    file: Buffer;
    fileName: string;
    mimeType: string;
    isPrimary?: boolean;
    position?: number;
    alt?: string;
  }>;
  variants?: Array<{
    sku: string;
    name: string;
    price?: number;
    comparePriceAt?: number;
    cost?: number;
    weight?: number;
    attributes?: Record<string, string>;
    trackInventory?: boolean;
  }>;
}

interface UpdateProductData extends Partial<CreateProductData> {
  id: string;
}

interface ProductSearchParams {
  query?: string;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  currency?: Currency;
  tags?: string[];
  attributes?: Record<string, string[]>;
  inStock?: boolean;
  isActive?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  limit?: number;
}

interface BulkUpdateData {
  productIds: string[];
  updates: {
    isActive?: boolean;
    categoryId?: string;
    tags?: string[];
    priceAdjustment?: {
      type: 'fixed' | 'percentage';
      value: number;
    };
  };
}

export class ProductService extends CrudService<Prisma.ProductDelegate<any>, 'product'> {
  imageRepo: ProductImageRepository;
  productRepo: ProductRepository;
  protected modelName: 'product' = 'product';

  constructor(app: FastifyInstance) {
    super(app);
    this.productRepo = new ProductRepository(app.prisma, app.redis, this.logger);
    this.imageRepo = new ProductImageRepository(app.prisma, app.redis, this.logger);
  }

  async create(data: CreateProductData): Promise<ServiceResult<Product>> {
    try {
      // Validate SKU uniqueness
      const existingProduct = await this.prisma.product.findUnique({
        where: { sku: data.sku }
      });
      if (existingProduct) {
        return {
          success: false,
          error: new ApiError('Product with this SKU already exists', 400, 'DUPLICATE_SKU')
        };
      }

      // Validate category
      if (data.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId }
        });
        if (!category) {
          return {
            success: false,
            error: new ApiError('Invalid category ID provided', 400, 'INVALID_CATEGORY')
          };
        }
      }


      // Start transaction
      const product = await this.prisma.$transaction(async (tx) => {
        // Create product
        const product = await tx.product.create({
          data: {
            sellerId: data.sellerId,
            sku: data.sku,
            name: data.name,
            slug: data.sku.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            description: data.description || '',
            shortDescription: data.shortDescription,
            price: data.price,
            compareAtPrice: data.compareAtPrice,
            currency: data.currency || 'USD',
            weight: data.weight,
            length: data.length,
            width: data.width,
            height: data.height,
            status: data.status ?? 'ACTIVE',
            requiresShipping: data.requiresShipping ?? true,
            trackInventory: data.trackInventory ?? true,
            categoryId: data.categoryId,
            brandId: data.brandId
          }
        });

        // Create attributes
        if (data.attributes?.length) {
          await tx.productAttribute.createMany({
            data: data.attributes.map(attr => ({
              productId: product.id,
              name: attr.name,
              value: attr.value
            }))
          });
        }

        // Create variants
        if (data.variants?.length) {
          for (const variantData of data.variants) {
            await tx.productVariant.create({
              data: {
                productId: product.id,
                sku: variantData.sku,
                name: variantData.name,
                price: variantData.price || product.price,
                attributes: variantData.attributes || {},
                quantity: 0
              }
            });
          }
        }

        return product;
      });

      // Update search index (simplified for now)
      // TODO: Fix search index implementation

      // Clear cache
      await cache.invalidatePattern('products:*');

      this.logger.info({ productId: product.id }, 'Product created successfully');

      return {
        success: true,
        data: product
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create product');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create product', 500)
      };
    }
  }

  async update(data: UpdateProductData): Promise<ServiceResult<Product>> {
    try {
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: data.id }
      });
      if (!existingProduct) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      // Validate SKU uniqueness if changing
      if (data.sku && data.sku !== existingProduct.sku) {
        const duplicateProduct = await this.prisma.product.findUnique({
          where: { sku: data.sku }
        });
        if (duplicateProduct) {
          return {
            success: false,
            error: new ApiError('Product with this SKU already exists', 400, 'DUPLICATE_SKU')
          };
        }
      }

      // Update product in transaction
      const product = await this.prisma.$transaction(async (tx) => {
        // Update product
        const updateData: Prisma.ProductUpdateInput = {};
        if (data.sku !== undefined) updateData.sku = data.sku;
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
        if (data.price !== undefined) updateData.price = data.price;
        if (data.compareAtPrice !== undefined) updateData.compareAtPrice = data.compareAtPrice;
        if (data.currency !== undefined) updateData.currency = data.currency;
        if (data.weight !== undefined) updateData.weight = data.weight;
        if (data.length !== undefined) updateData.length = data.length;
        if (data.width !== undefined) updateData.width = data.width;
        if (data.height !== undefined) updateData.height = data.height;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.requiresShipping !== undefined) updateData.requiresShipping = data.requiresShipping;
        if (data.trackInventory !== undefined) updateData.trackInventory = data.trackInventory;
        // categoryId and brandId need to be handled through relations if they exist in schema

        const product = await tx.product.update({
          where: { id: data.id },
          data: updateData
        });


        // Update attributes if provided
        if (data.attributes !== undefined) {
          // Remove existing
          await tx.productAttribute.deleteMany({
            where: { productId: product.id }
          });

          // Add new
          if (data.attributes.length > 0) {
            await tx.productAttribute.createMany({
              data: data.attributes.map(attr => ({
                productId: product.id,
                name: attr.name,
                value: attr.value
              }))
            });
          }
        }

        return product;
      });

      // Clear cache
      await cache.invalidatePattern(`products:${product.id}:*`);
      await cache.invalidatePattern('products:list:*');

      this.logger.info({ productId: product.id }, 'Product updated successfully');

      return {
        success: true,
        data: product
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to update product');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to update product', 500)
      };
    }
  }

  async delete(productId: string): Promise<ServiceResult<void>> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId }
      });
      if (!product) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      // Check if product has active orders
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
        return {
          success: false,
          error: new ApiError('Cannot delete product with active orders', 400, 'ACTIVE_ORDERS_EXIST')
        };
      }

      // Soft delete product by updating status
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          status: 'ARCHIVED'
        }
      });

      // Remove from search index
      await updateSearchIndex('products', { id: productId });

      // Clear cache
      await cache.invalidatePattern(`products:${productId}:*`);
      await cache.invalidatePattern('products:list:*');

      this.logger.info({ productId }, 'Product deleted successfully');

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error({ error }, 'Failed to delete product');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to delete product', 500)
      };
    }
  }

  async search(params: ProductSearchParams): Promise<ServiceResult<PaginatedResult<Product>>> {
    try {
      const cacheKey = `products:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<Product>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Use Typesense for search
      const searchResults = await searchProducts({
        query: params.query || '',
        filters: {
          categoryIds: params.categoryIds,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          currency: params.currency,
          tags: params.tags,
          attributes: params.attributes,
          inStock: params.inStock,
          isActive: params.isActive ?? true
        },
        sortBy: params.sortBy || 'relevance',
        page: params.page || 1,
        limit: params.limit || 20
      });

      // Get full product data
      const productIds = searchResults.hits.map(hit => hit.document.id);
      const products = await this.productRepo.findMany({ where: { id: { in: productIds } } });

      // Maintain search result order
      const productMap = products.reduce((acc: any, product: any) => {
        acc[product.id] = product;
        return acc;
      }, {} as Record<string, Product>);

      const orderedProducts = productIds
        .map(id => productMap[id])
        .filter(Boolean);

      const result: PaginatedResult<Product> = {
        data: orderedProducts,
        meta: {
          total: searchResults.found,
          page: params.page || 1,
          limit: params.limit || 20,
          totalPages: Math.ceil(searchResults.found / (params.limit || 20))
        }
      };

      // Cache for 5 minutes
      await cache.set(cacheKey, result, { ttl: 300 });

      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error }, 'Failed to search products');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search products', 500)
      };
    }
  }
}
import { Product, Prisma, Currency, ProductStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
// import { uploadToS3, deleteFromS3, generateImageVariants } from '../utils/storage';
import { updateSearchIndex, removeFromSearchIndex } from '../utils/search';
import { searchProducts } from '../utils/search';
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

// interface BulkUpdateData {
//   productIds: string[];
//   updates: {
//     isActive?: boolean;
//     categoryId?: string;
//     tags?: string[];
//     priceAdjustment?: {
//       type: 'fixed' | 'percentage';
//       value: number;
//     };
//   };
// }

export class ProductService extends CrudService<Product, any, any> {
  imageRepo: ProductImageRepository;
  productRepo: ProductRepository;
  public modelName: 'product' = 'product';

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

      // Validate seller existence
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId }
      });
      if (!seller) {
        return {
          success: false,
          error: new ApiError('Invalid seller ID provided', 400, 'INVALID_SELLER')
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

      // Validate brand
      if (data.brandId) {
        const brand = await this.prisma.brand.findUnique({
          where: { id: data.brandId }
        });
        if (!brand) {
          return {
            success: false,
            error: new ApiError('Invalid brand ID provided', 400, 'INVALID_BRAND')
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
            currency: data.currency || Currency.USD,
            weight: data.weight,
            length: data.length,
            width: data.width,
            height: data.height,
            status: data.status ?? ProductStatus.PUBLISHED,
            requiresShipping: data.requiresShipping ?? true,
            trackInventory: data.trackInventory ?? true,
            ...(data.categoryId && { categoryId: data.categoryId }),
            ...(data.brandId && { brandId: data.brandId })
          } as any
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

      // Update search index
      try {
        await updateSearchIndex('products', product);
      } catch (searchError) {
        this.logger.warn({ 
          err: searchError, 
          productId: product.id 
        }, 'Failed to update search index, product still created successfully');
      }

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

  async updateProduct(data: UpdateProductData): Promise<ServiceResult<Product>> {
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
        if (data.status !== undefined) updateData.status = data.status as any;
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

      // Update search index
      try {
        await updateSearchIndex('products', product);
      } catch (searchError) {
        this.logger.warn({ 
          err: searchError, 
          productId: product.id 
        }, 'Failed to update search index, product still updated successfully');
      }

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
      try {
        await removeFromSearchIndex('products', productId);
      } catch (searchError) {
        this.logger.warn({ 
          err: searchError, 
          productId 
        }, 'Failed to remove from search index, product still deleted successfully');
      }

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

      let result: PaginatedResult<Product>;

      try {
        // Try Typesense search first
        const searchFilters = {
          categories: params.categoryIds,
          priceMin: params.minPrice,
          priceMax: params.maxPrice,
          tags: params.tags,
          inStock: params.inStock
        };

        // Map sortBy parameter to Typesense format
        let sortBy = '_text_match:desc';
        if (params.sortBy) {
          switch (params.sortBy) {
            case 'price_asc':
              sortBy = 'price:asc';
              break;
            case 'price_desc':
              sortBy = 'price:desc';
              break;
            case 'newest':
              sortBy = 'created_at:desc';
              break;
            case 'popular':
              sortBy = 'total_reviews:desc,average_rating:desc';
              break;
            default:
              sortBy = '_text_match:desc';
          }
        }

        const searchResult = await searchProducts(
          params.query || '*',
          searchFilters,
          params.page || 1,
          params.limit || 20,
          sortBy
        );

        // Extract products from search hits
        const products = searchResult.hits.map(hit => hit.document) as Product[];

        result = {
          data: products,
          meta: {
            total: searchResult.found,
            page: params.page || 1,
            limit: params.limit || 20,
            totalPages: Math.ceil(searchResult.found / (params.limit || 20))
          }
        };

        this.logger.debug({ 
          query: params.query, 
          found: searchResult.found,
          searchTime: searchResult.search_time_ms 
        }, 'Typesense search completed');

      } catch (searchError) {
        // Fallback to database search if Typesense fails
        this.logger.warn({ 
          error: searchError,
          query: params.query 
        }, 'Typesense search failed, falling back to database search');

        const where: Prisma.ProductWhereInput = {};
        
        if (params.query) {
          where.OR = [
            { name: { contains: params.query, mode: 'insensitive' } },
            { description: { contains: params.query, mode: 'insensitive' } }
          ];
        }
        
        if (params.categoryIds?.length) {
          where.categoryId = { in: params.categoryIds };
        }
        
        if (params.minPrice || params.maxPrice) {
          where.price = {};
          if (params.minPrice) where.price.gte = params.minPrice;
          if (params.maxPrice) where.price.lte = params.maxPrice;
        }

        if (params.isActive !== undefined) {
          where.status = params.isActive ? ProductStatus.PUBLISHED : { not: ProductStatus.PUBLISHED };
        }
        
        // Apply sorting for database search
        let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
        if (params.sortBy) {
          switch (params.sortBy) {
            case 'price_asc':
              orderBy = { price: 'asc' };
              break;
            case 'price_desc':
              orderBy = { price: 'desc' };
              break;
            case 'newest':
              orderBy = { createdAt: 'desc' };
              break;
            case 'popular':
              orderBy = { name: 'asc' }; // Fallback since we don't have review counts in database
              break;
          }
        }
        
        const products = await this.productRepo.findMany({
          where,
          orderBy,
          take: params.limit || 20,
          skip: ((params.page || 1) - 1) * (params.limit || 20)
        });
        
        const total = await this.productRepo.count({ where });

        result = {
          data: products,
          meta: {
            total: total,
            page: params.page || 1,
            limit: params.limit || 20,
            totalPages: Math.ceil(total / (params.limit || 20))
          }
        };
      }

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
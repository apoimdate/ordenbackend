import { Product, Prisma, Currency, ProductStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
// import { uploadToS3, deleteFromS3, generateImageVariants } from '../utils/storage';
import { updateSearchIndex, removeFromSearchIndex } from '../utils/search';
import { searchProducts } from '../utils/search';
import { 
  ProductRepository, 
  ProductImageRepository
} from '../repositories';

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

  // PRODUCTION: Review Aggregation & Analytics

  async getProductReviews(productId: string, options: {
    page?: number;
    limit?: number;
    rating?: number; // Filter by specific rating
    verified?: boolean; // Filter by verified reviews
    sortBy?: 'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful';
  } = {}): Promise<ServiceResult<{
    reviews: Array<{
      id: string;
      userId: string;
      userName: string;
      rating: number;
      title?: string;
      comment: string;
      isVerified: boolean;
      status: string;
      createdAt: Date;
      helpfulCount: number;
      images?: string[];
    }>;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    summary: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: Record<number, number>;
      verifiedPercentage: number;
    };
  }>> {
    try {
      const product = await this.productRepo.findById(productId);
      if (!product) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      // Build review filters
      const where: Prisma.ReviewWhereInput = {
        productId,
        status: 'APPROVED' // Only show approved reviews
      };

      if (options.rating !== undefined) {
        where.rating = options.rating;
      }

      if (options.verified !== undefined) {
        where.isVerified = options.verified;
      }

      // Build sort order
      let orderBy: Prisma.ReviewOrderByWithRelationInput = { createdAt: 'desc' };
      switch (options.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'rating_high':
          orderBy = { rating: 'desc' };
          break;
        case 'rating_low':
          orderBy = { rating: 'asc' };
          break;
        case 'helpful':
          // Fallback to newest since helpfulness not in schema
          orderBy = { createdAt: 'desc' };
          break;
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      // Get reviews with user info
      const [reviews, total, allReviews] = await Promise.all([
        this.prisma.review.findMany({
          where,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            // Remove _count as it's not available in the current schema
          },
          orderBy,
          skip,
          take: limit
        }),
        this.prisma.review.count({ where }),
        // Get all reviews for summary stats
        this.prisma.review.findMany({
          where: { productId, status: 'APPROVED' },
          select: {
            rating: true,
            isVerified: true
          }
        })
      ]);

      // Calculate summary statistics
      const totalReviews = allReviews.length;
      const averageRating = totalReviews > 0 
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let verifiedCount = 0;

      allReviews.forEach(review => {
        ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
        if (review.isVerified) verifiedCount++;
      });

      const verifiedPercentage = totalReviews > 0 ? (verifiedCount / totalReviews) * 100 : 0;

      // Format review data
      const formattedReviews = reviews.map(review => ({
        id: review.id,
        userId: review.userId,
        userName: review.user?.firstName && review.user?.lastName 
          ? `${review.user.firstName} ${review.user.lastName}`
          : 'Anonymous',
        rating: review.rating,
        title: review.title || undefined,
        comment: review.comment,
        isVerified: review.isVerified,
        status: review.status as string,
        createdAt: review.createdAt,
        helpfulCount: 0, // Placeholder since votes not in current schema
        images: [] // Add if you have review images
      }));

      return {
        success: true,
        data: {
          reviews: formattedReviews,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          },
          summary: {
            averageRating: Math.round(averageRating * 100) / 100,
            totalReviews,
            ratingDistribution,
            verifiedPercentage: Math.round(verifiedPercentage * 100) / 100
          }
        }
      };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to get product reviews');
      return {
        success: false,
        error: new ApiError('Failed to get product reviews', 500, 'REVIEWS_ERROR')
      };
    }
  }

  async getProductReviewSummary(productId: string): Promise<ServiceResult<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
    verifiedPercentage: number;
    recentTrend: {
      last30Days: number;
      previousPeriod: number;
      trendPercentage: number;
    };
    qualityMetrics: {
      averageVerifiedRating: number;
      averageUnverifiedRating: number;
      detailedReviewsPercentage: number; // Reviews with >50 characters
    };
  }>> {
    try {
      const product = await this.productRepo.findById(productId);
      if (!product) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      // Get all approved reviews
      const allReviews = await this.prisma.review.findMany({
        where: {
          productId,
          status: 'APPROVED'
        },
        select: {
          rating: true,
          comment: true,
          isVerified: true,
          createdAt: true
        }
      });

      const totalReviews = allReviews.length;

      if (totalReviews === 0) {
        return {
          success: true,
          data: {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            verifiedPercentage: 0,
            recentTrend: {
              last30Days: 0,
              previousPeriod: 0,
              trendPercentage: 0
            },
            qualityMetrics: {
              averageVerifiedRating: 0,
              averageUnverifiedRating: 0,
              detailedReviewsPercentage: 0
            }
          }
        };
      }

      // Calculate basic metrics
      const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
      
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let verifiedCount = 0;
      let verifiedRatingSum = 0;
      let unverifiedRatingSum = 0;
      let unverifiedCount = 0;
      let detailedReviewsCount = 0;

      allReviews.forEach(review => {
        ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
        
        if (review.isVerified) {
          verifiedCount++;
          verifiedRatingSum += review.rating;
        } else {
          unverifiedCount++;
          unverifiedRatingSum += review.rating;
        }

        if (review.comment && review.comment.length > 50) {
          detailedReviewsCount++;
        }
      });

      // Calculate trend (last 30 days vs previous 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const last30DaysReviews = allReviews.filter(r => r.createdAt >= thirtyDaysAgo).length;
      const previousPeriodReviews = allReviews.filter(r => 
        r.createdAt >= sixtyDaysAgo && r.createdAt < thirtyDaysAgo
      ).length;

      const trendPercentage = previousPeriodReviews > 0 
        ? ((last30DaysReviews - previousPeriodReviews) / previousPeriodReviews) * 100
        : last30DaysReviews > 0 ? 100 : 0;

      return {
        success: true,
        data: {
          averageRating: Math.round(averageRating * 100) / 100,
          totalReviews,
          ratingDistribution,
          verifiedPercentage: Math.round((verifiedCount / totalReviews) * 10000) / 100,
          recentTrend: {
            last30Days: last30DaysReviews,
            previousPeriod: previousPeriodReviews,
            trendPercentage: Math.round(trendPercentage * 100) / 100
          },
          qualityMetrics: {
            averageVerifiedRating: verifiedCount > 0 
              ? Math.round((verifiedRatingSum / verifiedCount) * 100) / 100 
              : 0,
            averageUnverifiedRating: unverifiedCount > 0 
              ? Math.round((unverifiedRatingSum / unverifiedCount) * 100) / 100 
              : 0,
            detailedReviewsPercentage: Math.round((detailedReviewsCount / totalReviews) * 10000) / 100
          }
        }
      };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to get product review summary');
      return {
        success: false,
        error: new ApiError('Failed to get review summary', 500, 'REVIEW_SUMMARY_ERROR')
      };
    }
  }

  async getProductsWithReviewStats(options: {
    sellerId?: string;
    categoryId?: string;
    minRating?: number;
    minReviews?: number;
    sortBy?: 'rating' | 'review_count' | 'recent_reviews';
    page?: number;
    limit?: number;
  } = {}): Promise<ServiceResult<PaginatedResult<{
    id: string;
    name: string;
    price: number;
    averageRating: number;
    totalReviews: number;
    verifiedReviews: number;
    recentReviews: number; // last 30 days
    ratingTrend: number; // percentage change in rating
  }>>> {
    try {
      // Build product filters
      const where: Prisma.ProductWhereInput = {
        status: 'PUBLISHED'
      };

      if (options.sellerId) {
        where.sellerId = options.sellerId;
      }

      if (options.categoryId) {
        where.categoryId = options.categoryId;
      }

      // Get products with review aggregations
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const products = await this.prisma.product.findMany({
        where,
        include: {
          reviews: {
            where: { status: 'APPROVED' },
            select: {
              rating: true,
              isVerified: true,
              createdAt: true
            }
          }
        },
        skip,
        take: limit
      });

      const total = await this.prisma.product.count({ where });

      // Process review statistics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const productsWithStats = products
        .map(product => {
          const reviews = product.reviews;
          const totalReviews = reviews.length;
          
          if (totalReviews === 0) {
            return {
              id: product.id,
              name: product.name,
              price: parseFloat(product.price.toString()),
              averageRating: 0,
              totalReviews: 0,
              verifiedReviews: 0,
              recentReviews: 0,
              ratingTrend: 0
            };
          }

          const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
          const verifiedReviews = reviews.filter(r => r.isVerified).length;
          const recentReviews = reviews.filter(r => r.createdAt >= thirtyDaysAgo).length;

          // Calculate rating trend (recent vs previous period)
          const recentRatings = reviews.filter(r => r.createdAt >= thirtyDaysAgo);
          const previousRatings = reviews.filter(r => 
            r.createdAt >= sixtyDaysAgo && r.createdAt < thirtyDaysAgo
          );

          let ratingTrend = 0;
          if (recentRatings.length > 0 && previousRatings.length > 0) {
            const recentAvg = recentRatings.reduce((sum, r) => sum + r.rating, 0) / recentRatings.length;
            const previousAvg = previousRatings.reduce((sum, r) => sum + r.rating, 0) / previousRatings.length;
            ratingTrend = ((recentAvg - previousAvg) / previousAvg) * 100;
          }

          return {
            id: product.id,
            name: product.name,
            price: parseFloat(product.price.toString()),
            averageRating: Math.round(averageRating * 100) / 100,
            totalReviews,
            verifiedReviews,
            recentReviews,
            ratingTrend: Math.round(ratingTrend * 100) / 100
          };
        })
        .filter(product => {
          // Apply post-aggregation filters
          if (options.minRating && product.averageRating < options.minRating) {
            return false;
          }
          if (options.minReviews && product.totalReviews < options.minReviews) {
            return false;
          }
          return true;
        });

      // Apply sorting
      if (options.sortBy) {
        productsWithStats.sort((a, b) => {
          switch (options.sortBy) {
            case 'rating':
              return b.averageRating - a.averageRating;
            case 'review_count':
              return b.totalReviews - a.totalReviews;
            case 'recent_reviews':
              return b.recentReviews - a.recentReviews;
            default:
              return 0;
          }
        });
      }

      return {
        success: true,
        data: {
          data: productsWithStats,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error({ error, options }, 'Failed to get products with review stats');
      return {
        success: false,
        error: new ApiError('Failed to get products with review stats', 500, 'PRODUCT_STATS_ERROR')
      };
    }
  }

  async updateProductRatingCache(productId: string): Promise<ServiceResult<{
    averageRating: number;
    totalReviews: number;
  }>> {
    try {
      const reviews = await this.prisma.review.findMany({
        where: {
          productId,
          status: 'APPROVED'
        },
        select: { rating: true }
      });

      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      // Cache the results for quick access
      const cacheKey = `product:${productId}:rating_summary`;
      await cache.set(cacheKey, {
        averageRating: Math.round(averageRating * 100) / 100,
        totalReviews,
        lastUpdated: new Date()
      }, { ttl: 3600 }); // Cache for 1 hour

      return {
        success: true,
        data: {
          averageRating: Math.round(averageRating * 100) / 100,
          totalReviews
        }
      };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to update product rating cache');
      return {
        success: false,
        error: new ApiError('Failed to update rating cache', 500, 'CACHE_UPDATE_ERROR')
      };
    }
  }

}
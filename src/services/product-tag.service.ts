import { ProductTag, Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';
import { nanoid } from 'nanoid';

interface CreateProductTagData {
  productId: string;
  tag: string;
}

interface TagStats {
  tag: string;
  productCount: number;
  usage: {
    trending: boolean;
    growth: number; // percentage growth in last 30 days
  };
  categories: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
  }>;
  recentProducts: Array<{
    productId: string;
    productName: string;
    addedAt: Date;
  }>;
}

interface TagCloud {
  tags: Array<{
    tag: string;
    count: number;
    weight: number; // 1-10 for font sizing
    color?: string;
  }>;
  totalTags: number;
  totalProducts: number;
}

export class ProductTagService extends CrudService<ProductTag> {
  modelName = 'productTag' as const;

  constructor(app: FastifyInstance) {
    super(app);
  }

  /**
   * Add tag to product
   */
  async addTagToProduct(data: CreateProductTagData): Promise<ServiceResult<ProductTag>> {
    try {
      // Validate product exists
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId }
      });

      if (!product) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      // Normalize tag (lowercase, trim spaces)
      const normalizedTag = data.tag.toLowerCase().trim();
      
      if (!normalizedTag) {
        return {
          success: false,
          error: new ApiError('Tag cannot be empty', 400, 'EMPTY_TAG')
        };
      }

      // Check if tag already exists for this product
      const existingTag = await this.prisma.productTag.findFirst({
        where: {
          productId: data.productId,
          tag: normalizedTag
        }
      });

      if (existingTag) {
        return {
          success: false,
          error: new ApiError('Tag already exists for this product', 400, 'TAG_EXISTS')
        };
      }

      // Create tag
      const productTag = await this.prisma.productTag.create({
        data: {
          id: nanoid(),
          productId: data.productId,
          tag: normalizedTag
        }
      });

      // Clear caches
      await cache.invalidatePattern(`product-tags:*`);
      await cache.invalidatePattern(`products:${data.productId}:*`);

      // Emit event
      this.app.events?.emit('product.tag.added', {
        productId: data.productId,
        tag: normalizedTag
      });

      return { success: true, data: productTag };
    } catch (error) {
      this.logger.error({ error }, 'Failed to add tag to product');
      return {
        success: false,
        error: new ApiError('Failed to add tag', 500, 'ADD_TAG_ERROR')
      };
    }
  }

  /**
   * Remove tag from product
   */
  async removeTagFromProduct(productId: string, tag: string): Promise<ServiceResult<void>> {
    try {
      const normalizedTag = tag.toLowerCase().trim();
      
      const productTag = await this.prisma.productTag.findFirst({
        where: {
          productId,
          tag: normalizedTag
        }
      });

      if (!productTag) {
        return {
          success: false,
          error: new ApiError('Tag not found on product', 404, 'TAG_NOT_FOUND')
        };
      }

      await this.prisma.productTag.delete({
        where: { id: productTag.id }
      });

      // Clear caches
      await cache.invalidatePattern(`product-tags:*`);
      await cache.invalidatePattern(`products:${productId}:*`);

      // Emit event
      this.app.events?.emit('product.tag.removed', {
        productId,
        tag: normalizedTag
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error({ error, productId, tag }, 'Failed to remove tag from product');
      return {
        success: false,
        error: new ApiError('Failed to remove tag', 500, 'REMOVE_TAG_ERROR')
      };
    }
  }

  /**
   * Get all tags for a product
   */
  async getProductTags(productId: string): Promise<ServiceResult<ProductTag[]>> {
    try {
      const cacheKey = `product-tags:product:${productId}`;
      const cached = await cache.get<ProductTag[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const tags = await this.prisma.productTag.findMany({
        where: { productId },
        orderBy: { tag: 'asc' }
      });

      await cache.set(cacheKey, tags, { ttl: 600 });
      return { success: true, data: tags };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to get product tags');
      return {
        success: false,
        error: new ApiError('Failed to get product tags', 500, 'GET_TAGS_ERROR')
      };
    }
  }

  /**
   * Get products by tag
   */
  async getProductsByTag(tag: string, options: {
    page?: number;
    limit?: number;
    sortBy?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
    categoryId?: string;
    sellerId?: string;
  } = {}): Promise<ServiceResult<PaginatedResult<any>>> {
    try {
      const normalizedTag = tag.toLowerCase().trim();
      
      // Build product filters
      const where: Prisma.ProductWhereInput = {
        status: 'PUBLISHED',
        tags: {
          some: {
            tag: normalizedTag
          }
        }
      };

      if (options.categoryId) {
        where.categoryId = options.categoryId;
      }

      if (options.sellerId) {
        where.sellerId = options.sellerId;
      }

      // Build sort order
      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
      switch (options.sortBy) {
        case 'popular':
          orderBy = { name: 'asc' }; // Placeholder - would use view count in production
          break;
        case 'price_asc':
          orderBy = { price: 'asc' };
          break;
        case 'price_desc':
          orderBy = { price: 'desc' };
          break;
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: {
            images: {
              where: { isPrimary: true },
              take: 1
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
            tags: {
              orderBy: { tag: 'asc' },
              take: 5
            }
          },
          orderBy,
          skip,
          take: limit
        }),
        this.prisma.product.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: products,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error({ error, tag }, 'Failed to get products by tag');
      return {
        success: false,
        error: new ApiError('Failed to get products by tag', 500, 'GET_PRODUCTS_ERROR')
      };
    }
  }

  /**
   * Get popular tags
   */
  async getPopularTags(options: {
    limit?: number;
    categoryId?: string;
    minUsage?: number;
    period?: 'all' | 'month' | 'week';
  } = {}): Promise<ServiceResult<Array<{
    tag: string;
    count: number;
    trending: boolean;
  }>>> {
    try {
      const cacheKey = `product-tags:popular:${JSON.stringify(options)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Note: Date filtering not available as ProductTag model doesn't have createdAt field

      // Build product filter
      let productFilter: Prisma.ProductWhereInput = {
        status: 'PUBLISHED'
      };
      
      if (options.categoryId) {
        productFilter.categoryId = options.categoryId;
      }

      // Get tag counts
      const tagCounts = await this.prisma.productTag.groupBy({
        by: ['tag'],
        where: {
          product: productFilter
        },
        _count: true,
        orderBy: {
          tag: 'asc'
        },
        take: options.limit || 50
      });

      // Note: Trending calculation not available as ProductTag model doesn't have createdAt field
      // For now, mark top tags as trending based on usage count
      const trendingTags = new Set<string>();
      const averageCount = tagCounts.reduce((sum, tc) => sum + tc._count, 0) / tagCounts.length;
      
      tagCounts.slice(0, 10).forEach(tagCount => {
        if (tagCount._count > averageCount * 1.5) {
          trendingTags.add(tagCount.tag);
        }
      });

      const result = tagCounts.map(tagCount => ({
        tag: tagCount.tag,
        count: tagCount._count,
        trending: trendingTags.has(tagCount.tag)
      }));

      await cache.set(cacheKey, result, { ttl: 3600 });
      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get popular tags');
      return {
        success: false,
        error: new ApiError('Failed to get popular tags', 500, 'GET_POPULAR_TAGS_ERROR')
      };
    }
  }

  /**
   * Get tag statistics
   */
  async getTagStats(tag: string): Promise<ServiceResult<TagStats>> {
    try {
      const normalizedTag = tag.toLowerCase().trim();
      const cacheKey = `product-tags:stats:${normalizedTag}`;
      const cached = await cache.get<TagStats>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Get tag usage count
      const productCount = await this.prisma.productTag.count({
        where: {
          tag: normalizedTag,
          product: {
            status: 'PUBLISHED'
          }
        }
      });

      if (productCount === 0) {
        return {
          success: false,
          error: new ApiError('Tag not found', 404, 'TAG_NOT_FOUND')
        };
      }

      // Note: Growth calculation not available as ProductTag model doesn't have createdAt field
      // For now, estimate trending based on usage count compared to average
      const allTagCounts = await this.prisma.productTag.groupBy({
        by: ['tag'],
        where: {
          product: { status: 'PUBLISHED' }
        },
        _count: true
      });
      
      const averageUsage = allTagCounts.reduce((sum, tc) => sum + tc._count, 0) / allTagCounts.length;
      const growth = productCount > averageUsage ? ((productCount - averageUsage) / averageUsage) * 100 : 0;
      const trending = productCount > averageUsage * 1.5;

      // Get category breakdown - simplified approach
      const productsWithCategory = await this.prisma.product.findMany({
        where: {
          tags: {
            some: {
              tag: normalizedTag
            }
          },
          status: 'PUBLISHED'
        },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Count categories
      const categoryCountMap = new Map<string, { name: string; count: number }>();
      productsWithCategory.forEach(product => {
        if (product.categoryId && product.category) {
          const existing = categoryCountMap.get(product.categoryId) || {
            name: product.category.name,
            count: 0
          };
          existing.count++;
          categoryCountMap.set(product.categoryId, existing);
        }
      });

      const categoryStats = Array.from(categoryCountMap.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count);

      // Get recent products
      const recentProducts = await this.prisma.productTag.findMany({
        where: {
          tag: normalizedTag,
          product: { status: 'PUBLISHED' }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { tag: 'asc' },
        take: 5
      });

      const stats: TagStats = {
        tag: normalizedTag,
        productCount,
        usage: {
          trending,
          growth: Math.round(growth * 100) / 100
        },
        categories: categoryStats,
        recentProducts: recentProducts.map(pt => ({
          productId: pt.product.id,
          productName: pt.product.name,
          addedAt: new Date() // Placeholder since createdAt is not available
        }))
      };

      await cache.set(cacheKey, stats, { ttl: 3600 });
      return { success: true, data: stats };
    } catch (error) {
      this.logger.error({ error, tag }, 'Failed to get tag stats');
      return {
        success: false,
        error: new ApiError('Failed to get tag stats', 500, 'TAG_STATS_ERROR')
      };
    }
  }

  /**
   * Generate tag cloud
   */
  async generateTagCloud(options: {
    maxTags?: number;
    categoryId?: string;
    minUsage?: number;
  } = {}): Promise<ServiceResult<TagCloud>> {
    try {
      const cacheKey = `product-tags:cloud:${JSON.stringify(options)}`;
      const cached = await cache.get<TagCloud>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Build product filter
      let productFilter: Prisma.ProductWhereInput = {
        status: 'PUBLISHED'
      };
      
      if (options.categoryId) {
        productFilter.categoryId = options.categoryId;
      }

      // Get tag counts
      const tagCounts = await this.prisma.productTag.groupBy({
        by: ['tag'],
        where: {
          product: productFilter
        },
        _count: true,
        orderBy: {
          tag: 'asc'
        },
        take: options.maxTags || 100
      });

      if (tagCounts.length === 0) {
        return {
          success: true,
          data: {
            tags: [],
            totalTags: 0,
            totalProducts: 0
          }
        };
      }

      // Sort by count for weight calculation
      const sortedTagCounts = tagCounts.sort((a, b) => b._count - a._count);
      
      // Calculate weights (1-10 scale)
      const maxCount = sortedTagCounts[0]?._count || 1;
      const minCount = sortedTagCounts[sortedTagCounts.length - 1]?._count || 1;
      const range = maxCount - minCount;

      const tags = sortedTagCounts.map(tagCount => {
        let weight = 1;
        if (range > 0) {
          weight = Math.ceil(((tagCount._count - minCount) / range) * 9) + 1;
        } else {
          weight = 5; // Middle weight if all counts are the same
        }

        return {
          tag: tagCount.tag,
          count: tagCount._count,
          weight,
          color: this.generateTagColor(tagCount.tag)
        };
      });

      // Get total unique products with tags
      const totalProducts = await this.prisma.product.count({
        where: {
          ...productFilter,
          tags: {
            some: {}
          }
        }
      });

      const tagCloud: TagCloud = {
        tags: tags.sort(() => Math.random() - 0.5), // Shuffle for visual appeal
        totalTags: tagCounts.length,
        totalProducts
      };

      await cache.set(cacheKey, tagCloud, { ttl: 3600 });
      return { success: true, data: tagCloud };
    } catch (error) {
      this.logger.error({ error }, 'Failed to generate tag cloud');
      return {
        success: false,
        error: new ApiError('Failed to generate tag cloud', 500, 'TAG_CLOUD_ERROR')
      };
    }
  }

  /**
   * Generate color for tag based on its name
   */
  private generateTagColor(tag: string): string {
    // Generate a consistent color based on tag hash
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      const char = tag.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Generate HSL color with fixed saturation and lightness for consistency
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  }

  /**
   * Bulk add tags to product
   */
  async bulkAddTagsToProduct(productId: string, tags: string[]): Promise<ServiceResult<{
    added: number;
    skipped: number;
    errors: string[];
  }>> {
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

      let added = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Get existing tags
      const existingTags = await this.prisma.productTag.findMany({
        where: { productId },
        select: { tag: true }
      });
      const existingTagSet = new Set(existingTags.map(t => t.tag));

      // Process each tag
      for (const tag of tags) {
        const normalizedTag = tag.toLowerCase().trim();
        
        if (!normalizedTag) {
          errors.push(`Empty tag skipped`);
          skipped++;
          continue;
        }

        if (existingTagSet.has(normalizedTag)) {
          skipped++;
          continue;
        }

        try {
          await this.prisma.productTag.create({
            data: {
              id: nanoid(),
              productId,
              tag: normalizedTag
            }
          });
          added++;
          existingTagSet.add(normalizedTag);
        } catch (error: any) {
          errors.push(`Failed to add tag '${normalizedTag}': ${error.message}`);
          skipped++;
        }
      }

      // Clear caches
      if (added > 0) {
        await cache.invalidatePattern(`product-tags:*`);
        await cache.invalidatePattern(`products:${productId}:*`);
      }

      return {
        success: true,
        data: { added, skipped, errors }
      };
    } catch (error) {
      this.logger.error({ error, productId }, 'Failed to bulk add tags');
      return {
        success: false,
        error: new ApiError('Failed to bulk add tags', 500, 'BULK_ADD_ERROR')
      };
    }
  }

  /**
   * Search tags by name
   */
  async searchTags(query: string, limit = 20): Promise<ServiceResult<Array<{
    tag: string;
    count: number;
  }>>> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      
      const tags = await this.prisma.productTag.groupBy({
        by: ['tag'],
        where: {
          tag: {
            contains: normalizedQuery,
            mode: 'insensitive'
          },
          product: {
            status: 'PUBLISHED'
          }
        },
        _count: true,
        orderBy: {
          tag: 'asc'
        },
        take: limit
      });

      const result = tags.map(tag => ({
        tag: tag.tag,
        count: tag._count
      }));

      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error, query }, 'Failed to search tags');
      return {
        success: false,
        error: new ApiError('Failed to search tags', 500, 'SEARCH_TAGS_ERROR')
      };
    }
  }
}
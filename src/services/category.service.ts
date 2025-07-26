import { Category, Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { 
  CategoryRepository,
  ProductRepository
} from "../repositories";
import { ServiceResult, PaginatedResult } from '../types';
import { cache } from '../utils/cache';
import { ApiError } from '../utils/errors';
import { updateSearchIndex } from '../utils/search';
import { deleteFromS3 } from '../utils/storage';

interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  bannerUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  isActive?: boolean;
  sortOrder?: number;
  translations?: Array<{
    language: string;
    name: string;
    description?: string;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  }>;
}


interface CategorySearchParams {
  query?: string;
  parentId?: string;
  level?: number;
  isActive?: boolean;
  hasProducts?: boolean;
  language?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name_asc' | 'name_desc' | 'created_asc' | 'created_desc' | 'order_asc' | 'order_desc';
  includeChildren?: boolean;
  includeTranslations?: boolean;
}

interface CategoryWithDetails extends Category {
  parent?: {
    id: string;
    name: string;
    slug: string;
  };
  children?: CategoryWithDetails[];
  translations?: any[];
  _count: {
    products: number;
    children: number;
  };
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  translations?: any[];
  productCount: number;
  level: number;
}

interface CategoryPathNode {
  id: string;
  name: string;
  slug: string;
  level: number;
}

export class CategoryService extends CrudService<Category, Prisma.CategoryCreateInput, Prisma.CategoryUpdateInput> {
  modelName = 'category' as const;

  private categoryRepo: CategoryRepository;
  private productRepo: ProductRepository;

  constructor(app: FastifyInstance) {
    super(app);
    this.categoryRepo = new CategoryRepository(app.prisma, app.redis, this.logger);
    this.productRepo = new ProductRepository(app.prisma, app.redis, this.logger);
  }

  async createCategory(data: CreateCategoryData): Promise<ServiceResult<Category>> {
    try {
      // Generate slug if not provided
      const slug = data.slug || this.generateSlug(data.name);

      // Check if slug is unique
      const existingCategory = await this.categoryRepo.findBySlug(slug);
      if (existingCategory) {
        return {
          success: false,
          error: new ApiError('Category slug already exists', 400, 'SLUG_EXISTS')
        };
      }

      // Validate parent category if provided
      if (data.parentId) {
        const parentCategory = await this.categoryRepo.findById(data.parentId);
        if (!parentCategory) {
          return {
            success: false,
            error: new ApiError('Parent category not found', 404, 'PARENT_NOT_FOUND')
          };
        }
      }

      const category = await this.prisma.$transaction(async (tx) => {
        // Create category
        const category = await tx.category.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            parentId: data.parentId,
            imageUrl: data.imageUrl,
            isActive: data.isActive ?? true,
            sortOrder: data.sortOrder ?? 0,
            type: 'PRODUCT'
          }
        });

        return category;
      });

      // Update search index
      await updateSearchIndex('categories', {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        isActive: category.isActive,
        level: await this.getCategoryLevel(category.id),
        createdAt: category.createdAt.getTime()
      });

      // Invalidate category cache
      await cache.invalidatePattern('categories:*');

      this.logger.info({ 
        categoryId: category.id, 
        name: category.name, 
        slug: category.slug 
      }, 'Category created');

      return {
        success: true,
        data: category
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create category');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to create category', 500)
      };
    }
  }

  async update(categoryId: string, data: Partial<CreateCategoryData>): Promise<ServiceResult<Category>> {
    try {
      const existingCategory = await this.categoryRepo.findById(categoryId);
      if (!existingCategory) {
        return {
          success: false,
          error: new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
        };
      }

      // Check slug uniqueness if changing
      if (data.name || data.slug) {
        const newSlug = data.slug || (data.name ? this.generateSlug(data.name) : existingCategory.slug);
        if (newSlug !== existingCategory.slug) {
          const slugExists = await this.categoryRepo.findBySlug(newSlug);
          if (slugExists) {
            return {
              success: false,
              error: new ApiError('Category slug already exists', 400, 'SLUG_EXISTS')
            };
          }
        }
      }

      // Validate parent category if changing
      if (data.parentId && data.parentId !== existingCategory.parentId) {
        if (data.parentId === categoryId) {
          return {
            success: false,
            error: new ApiError('Category cannot be its own parent', 400, 'INVALID_PARENT')
          };
        }

        const parentCategory = await this.categoryRepo.findById(data.parentId);
        if (!parentCategory) {
          return {
            success: false,
            error: new ApiError('Parent category not found', 404, 'PARENT_NOT_FOUND')
          };
        }

        // Check for circular reference
        const isCircular = await this.checkCircularReference(categoryId, data.parentId);
        if (isCircular) {
          return {
            success: false,
            error: new ApiError('Circular reference detected', 400, 'CIRCULAR_REFERENCE')
          };
        }
      }

      const category = await this.prisma.$transaction(async (tx) => {
        // Update category
        const updatedSlug = data.slug || (data.name ? this.generateSlug(data.name) : undefined);
        
        const category = await tx.category.update({
          where: { id: categoryId },
          data: {
            name: data.name,
            slug: updatedSlug,
            description: data.description,
            parentId: data.parentId,
            imageUrl: data.imageUrl,
            isActive: data.isActive,
            sortOrder: data.sortOrder
          }
        });

        return category;
      });

      // Update search index
      await updateSearchIndex('categories', {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        isActive: category.isActive,
        level: await this.getCategoryLevel(category.id)
      });

      // Invalidate category cache
      await cache.invalidatePattern('categories:*');

      this.logger.info({ categoryId: category.id }, 'Category updated');

      return {
        success: true,
        data: category
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to update category');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to update category', 500)
      };
    }
  }

  async delete(categoryId: string): Promise<ServiceResult<void>> {
    try {
      const category = await this.categoryRepo.findById(categoryId);
      if (!category) {
        return {
          success: false,
          error: new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
        };
      }

      // Check if category has products
      const productCount = await this.productRepo.count({
        where: { categoryId }
      });

      if (productCount > 0) {
        return {
          success: false,
          error: new ApiError('Cannot delete category with products', 400, 'CATEGORY_HAS_PRODUCTS')
        };
      }

      // Check if category has children
      const childrenCount = await this.categoryRepo.count({
        where: { parentId: categoryId }
      });

      if (childrenCount > 0) {
        return {
          success: false,
          error: new ApiError('Cannot delete category with subcategories', 400, 'CATEGORY_HAS_CHILDREN')
        };
      }

      await this.prisma.$transaction(async (tx) => {
        // Delete category
        await tx.category.delete({
          where: { id: categoryId }
        });
      });

      // Delete from search index
      await updateSearchIndex('categories', null);

      // Delete images if they exist
      if (category.imageUrl) {
        await deleteFromS3(category.imageUrl);
      }

      // Invalidate category cache
      await cache.invalidatePattern('categories:*');

      this.logger.info({ categoryId }, 'Category deleted');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to delete category');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to delete category', 500)
      };
    }
  }

  async getById(categoryId: string, includeDetails: boolean = true): Promise<ServiceResult<CategoryWithDetails | Category>> {
    try {
      const cacheKey = `categories:${categoryId}:${includeDetails ? 'detailed' : 'basic'}`;
      const cached = await cache.get<CategoryWithDetails | Category>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let category;
      if (includeDetails) {
        category = await this.categoryRepo.findById(categoryId, {
          include: {
            parent: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            children: {
              where: { isActive: true },
              include: {
                _count: {
                  select: {
                    products: true,
                    children: true
                  }
                }
              },
              orderBy: { sortOrder: 'asc' }
            },
            _count: {
              select: {
                products: true,
                children: true
              }
            }
          }
        });
      } else {
        category = await this.categoryRepo.findById(categoryId);
      }

      if (!category) {
        return {
          success: false,
          error: new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
        };
      }

      // Cache for 30 minutes
      await cache.set(cacheKey, category, { ttl: 1800 });

      return {
        success: true,
        data: category
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get category');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get category', 500)
      };
    }
  }

  async getBySlug(slug: string, includeDetails: boolean = true): Promise<ServiceResult<CategoryWithDetails | Category>> {
    try {
      const cacheKey = `categories:slug:${slug}:${includeDetails ? 'detailed' : 'basic'}`;
      const cached = await cache.get<CategoryWithDetails | Category>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      let category;
      if (includeDetails) {
        category = await this.categoryRepo.findBySlug(slug, {
          include: {
            parent: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            children: {
              where: { isActive: true },
              include: {
                _count: {
                  select: {
                    products: true,
                    children: true
                  }
                }
              },
              orderBy: { sortOrder: 'asc' }
            },
            _count: {
              select: {
                products: true,
                children: true
              }
            }
          }
        });
      } else {
        category = await this.categoryRepo.findBySlug(slug);
      }

      if (!category) {
        return {
          success: false,
          error: new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
        };
      }

      // Cache for 30 minutes
      await cache.set(cacheKey, category, { ttl: 1800 });

      return {
        success: true,
        data: category
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get category by slug');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get category by slug', 500)
      };
    }
  }

  async search(params: CategorySearchParams): Promise<ServiceResult<PaginatedResult<CategoryWithDetails>>> {
    try {
      const cacheKey = `categories:search:${JSON.stringify(params)}`;
      const cached = await cache.get<PaginatedResult<CategoryWithDetails>>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const where: Prisma.CategoryWhereInput = {};

      if (params.query) {
        where.OR = [
          { name: { contains: params.query, mode: 'insensitive' } },
          { description: { contains: params.query, mode: 'insensitive' } },
          { slug: { contains: params.query, mode: 'insensitive' } }
        ];
      }

      if (params.parentId !== undefined) {
        where.parentId = params.parentId;
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      if (params.hasProducts !== undefined) {
        if (params.hasProducts) {
          where.products = { some: {} };
        } else {
          where.products = { none: {} };
        }
      }

      // Determine sort order
      let orderBy: Prisma.CategoryOrderByWithRelationInput = { sortOrder: 'asc' };
      switch (params.sortBy) {
        case 'name_asc':
          orderBy = { name: 'asc' };
          break;
        case 'name_desc':
          orderBy = { name: 'desc' };
          break;
        case 'created_asc':
          orderBy = { createdAt: 'asc' };
          break;
        case 'created_desc':
          orderBy = { createdAt: 'desc' };
          break;
        case 'order_desc':
          orderBy = { sortOrder: 'desc' };
          break;
      }

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const includeOptions: any = {
        _count: {
          select: {
            products: true,
            children: true
          }
        }
      };

      if (params.includeChildren) {
        includeOptions.children = {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        };
      }

      const [categories, total] = await Promise.all([
        this.categoryRepo.findMany({
          where,
          include: includeOptions,
          orderBy,
          skip,
          take: limit
        }),
        this.categoryRepo.count({ where })
      ]);

      const result: PaginatedResult<CategoryWithDetails> = {
        data: categories as CategoryWithDetails[],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };

      // Cache for 10 minutes
      await cache.set(cacheKey, result, { ttl: 600 });

      return { success: true, data: result };
    } catch (error) {
      this.logger.error({ error }, 'Failed to search categories');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to search categories', 500)
      };
    }
  }

  async getCategoryTree(language?: string): Promise<ServiceResult<CategoryTreeNode[]>> {
    try {
      const cacheKey = `categories:tree:${language || 'default'}`;
      const cached = await cache.get<CategoryTreeNode[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const categories = await this.categoryRepo.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });

      const tree = this.buildCategoryTree(categories);

      // Cache for 1 hour
      await cache.set(cacheKey, tree, { ttl: 3600 });

      return { success: true, data: tree };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get category tree');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get category tree', 500)
      };
    }
  }

  async getCategoryPath(categoryId: string): Promise<ServiceResult<CategoryPathNode[]>> {
    try {
      const cacheKey = `categories:path:${categoryId}`;
      const cached = await cache.get<CategoryPathNode[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const path: CategoryPathNode[] = [];
      let currentId: string | null = categoryId;
      let level = 0;

      while (currentId) {
        const category = await this.categoryRepo.findById(currentId);
        if (!category) break;

        path.unshift({
          id: category.id,
          name: category.name,
          slug: category.slug,
          level
        });

        currentId = category.parentId;
        level++;
      }

      // Cache for 1 hour
      await cache.set(cacheKey, path, { ttl: 3600 });

      return { success: true, data: path };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get category path');
      return {
        success: false,
        error: error instanceof ApiError ? error : new ApiError('Failed to get category path', 500)
      };
    }
  }

  // Private helper methods
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async getCategoryLevel(categoryId: string): Promise<number> {
    let level = 0;
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.categoryRepo.findById(currentId);
      if (!category || !category.parentId) break;
      
      currentId = category.parentId;
      level++;
    }

    return level;
  }

  private async checkCircularReference(categoryId: string, parentId: string): Promise<boolean> {
    let currentId: string | null = parentId;

    while (currentId) {
      if (currentId === categoryId) {
        return true;
      }

      const category = await this.categoryRepo.findById(currentId);
      if (!category) break;

      currentId = category.parentId;
    }

    return false;
  }

  private buildCategoryTree(categories: any[], parentId: string | null = null, level: number = 0): CategoryTreeNode[] {
    const children = categories
      .filter(cat => cat.parentId === parentId)
      .map(cat => ({
        ...cat,
        children: this.buildCategoryTree(categories, cat.id, level + 1),
        productCount: cat._count.products,
        level
      }));

    return children;
  }

  // PRODUCTION: Enhanced Category Analytics

  async getCategoryAnalytics(categoryId: string): Promise<ServiceResult<{
    category: Category;
    productCount: number;
    directProductCount: number;
    subcategoryCount: number;
    totalSubcategoryCount: number;
    averageProductPrice: number;
    priceRange: { min: number; max: number };
    activeProductCount: number;
    outOfStockCount: number;
    recentlyAddedProducts: number; // last 30 days
    topProducts: Array<{
      id: string;
      name: string;
      price: number;
      viewCount?: number;
      orderCount?: number;
    }>;
    subcategoryBreakdown: Array<{
      id: string;
      name: string;
      productCount: number;
      activeProductCount: number;
    }>;
  }>> {
    try {
      const category = await this.categoryRepo.findById(categoryId);
      if (!category) {
        return {
          success: false,
          error: new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
        };
      }

      // Get all descendant category IDs
      const descendantIds = await this.getAllDescendantIds(categoryId);
      const allCategoryIds = [categoryId, ...descendantIds];

      // Get product statistics
      const products = await this.productRepo.findMany({
        where: {
          categoryId: { in: allCategoryIds }
        },
        include: {
          _count: {
            select: {
              orderItems: true,
              views: true
            }
          }
        }
      });

      const directProducts = products.filter(p => p.categoryId === categoryId);
      const activeProducts = products.filter(p => p.status === 'PUBLISHED');
      const outOfStockProducts = products.filter(p => p.quantity === 0);

      // Price analytics
      const prices = products.map(p => parseFloat(p.price.toString()));
      const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Recently added products (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentProducts = products.filter(p => p.createdAt >= thirtyDaysAgo);

      // Top products by order count
      const topProducts = products
        .sort((a, b) => (b as any)._count.orderItems - (a as any)._count.orderItems)
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price.toString()),
          viewCount: (p as any)._count.views,
          orderCount: (p as any)._count.orderItems
        }));

      // Subcategory breakdown
      const directSubcategories = await this.categoryRepo.findMany({
        where: { parentId: categoryId },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      const subcategoryBreakdown = await Promise.all(
        directSubcategories.map(async (subcat) => {
          const subcatDescendants = await this.getAllDescendantIds(subcat.id);
          const subcatAllIds = [subcat.id, ...subcatDescendants];
          
          const subcatProducts = await this.productRepo.findMany({
            where: { categoryId: { in: subcatAllIds } }
          });

          return {
            id: subcat.id,
            name: subcat.name,
            productCount: subcatProducts.length,
            activeProductCount: subcatProducts.filter(p => p.status === 'PUBLISHED').length
          };
        })
      );

      return {
        success: true,
        data: {
          category,
          productCount: products.length,
          directProductCount: directProducts.length,
          subcategoryCount: directSubcategories.length,
          totalSubcategoryCount: descendantIds.length,
          averageProductPrice: Math.round(averagePrice * 100) / 100,
          priceRange: { min: minPrice, max: maxPrice },
          activeProductCount: activeProducts.length,
          outOfStockCount: outOfStockProducts.length,
          recentlyAddedProducts: recentProducts.length,
          topProducts,
          subcategoryBreakdown
        }
      };
    } catch (error) {
      this.logger.error({ error, categoryId }, 'Failed to get category analytics');
      return {
        success: false,
        error: new ApiError('Failed to get category analytics', 500, 'ANALYTICS_ERROR')
      };
    }
  }

  async getCategoriesOverview(): Promise<ServiceResult<{
    totalCategories: number;
    activeCategories: number;
    rootCategories: number;
    categoriesWithProducts: number;
    categoriesWithoutProducts: number;
    averageProductsPerCategory: number;
    mostPopularCategories: Array<{
      id: string;
      name: string;
      productCount: number;
      level: number;
    }>;
    categoryDepthDistribution: Record<number, number>;
    recentlyCreatedCategories: Category[];
  }>> {
    try {
      const allCategories = await this.categoryRepo.findMany({
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      const activeCategories = allCategories.filter(c => c.isActive);
      const rootCategories = allCategories.filter(c => !c.parentId);
      const categoriesWithProducts = allCategories.filter(c => (c as any)._count.products > 0);
      const categoriesWithoutProducts = allCategories.filter(c => (c as any)._count.products === 0);

      const totalProducts = allCategories.reduce((sum, c) => sum + (c as any)._count.products, 0);
      const averageProductsPerCategory = allCategories.length > 0 ? totalProducts / allCategories.length : 0;

      // Most popular categories by product count
      const mostPopularCategories = await Promise.all(
        allCategories
          .sort((a, b) => (b as any)._count.products - (a as any)._count.products)
          .slice(0, 10)
          .map(async (cat) => ({
            id: cat.id,
            name: cat.name,
            productCount: (cat as any)._count.products,
            level: await this.getCategoryLevel(cat.id)
          }))
      );

      // Category depth distribution
      const depthDistribution: Record<number, number> = {};
      for (const category of allCategories) {
        const level = await this.getCategoryLevel(category.id);
        depthDistribution[level] = (depthDistribution[level] || 0) + 1;
      }

      // Recently created categories (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCategories = allCategories
        .filter(c => c.createdAt >= thirtyDaysAgo)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      return {
        success: true,
        data: {
          totalCategories: allCategories.length,
          activeCategories: activeCategories.length,
          rootCategories: rootCategories.length,
          categoriesWithProducts: categoriesWithProducts.length,
          categoriesWithoutProducts: categoriesWithoutProducts.length,
          averageProductsPerCategory: Math.round(averageProductsPerCategory * 100) / 100,
          mostPopularCategories,
          categoryDepthDistribution: depthDistribution,
          recentlyCreatedCategories: recentCategories
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get categories overview');
      return {
        success: false,
        error: new ApiError('Failed to get categories overview', 500, 'OVERVIEW_ERROR')
      };
    }
  }

  async getCategoryPerformanceMetrics(categoryId: string, timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<ServiceResult<{
    period: { start: Date; end: Date };
    productViews: number;
    orderCount: number;
    revenue: number;
    averageOrderValue: number;
    conversionRate: number;
    topSellingProducts: Array<{
      id: string;
      name: string;
      quantity: number;
      revenue: number;
    }>;
    dailyStats: Array<{
      date: string;
      views: number;
      orders: number;
      revenue: number;
    }>;
  }>> {
    try {
      const category = await this.categoryRepo.findById(categoryId);
      if (!category) {
        return {
          success: false,
          error: new ApiError('Category not found', 404, 'CATEGORY_NOT_FOUND')
        };
      }

      // Calculate time period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Get all descendant category IDs
      const descendantIds = await this.getAllDescendantIds(categoryId);
      const allCategoryIds = [categoryId, ...descendantIds];

      // Get products in this category tree
      const products = await this.productRepo.findMany({
        where: { categoryId: { in: allCategoryIds } }
      });
      const productIds = products.map(p => p.id);

      // Get order items for performance metrics
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        include: {
          order: true,
          product: {
            select: { id: true, name: true }
          }
        }
      });

      // Calculate metrics
      const orderCount = new Set(orderItems.map(item => item.orderId)).size;
      const revenue = orderItems.reduce((sum, item) => 
        sum + (parseFloat(item.price.toString()) * item.quantity), 0
      );
      const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      // Get product views (if analytics available)
      const productViews = await this.prisma.productView.count({
        where: {
          productId: { in: productIds },
          viewedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const conversionRate = productViews > 0 ? (orderCount / productViews) * 100 : 0;

      // Top selling products
      const productSales: Record<string, { quantity: number; revenue: number; name: string }> = {};
      orderItems.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            quantity: 0,
            revenue: 0,
            name: item.product.name
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += parseFloat(item.price.toString()) * item.quantity;
      });

      const topSellingProducts = Object.entries(productSales)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Daily stats
      const dailyStats: Record<string, { views: number; orders: Set<string>; revenue: number }> = {};
      
      // Initialize all days
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dailyStats[dateKey] = { views: 0, orders: new Set(), revenue: 0 };
      }

      // Populate order data
      orderItems.forEach(item => {
        const dateKey = item.order.createdAt.toISOString().split('T')[0];
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].orders.add(item.orderId);
          dailyStats[dateKey].revenue += parseFloat(item.price.toString()) * item.quantity;
        }
      });

      // Get view data if available
      const viewData = await this.prisma.productView.findMany({
        where: {
          productId: { in: productIds },
          viewedAt: { gte: startDate, lte: endDate }
        }
      });

      viewData.forEach(view => {
        const dateKey = view.viewedAt.toISOString().split('T')[0];
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].views += 1;
        }
      });

      const dailyStatsArray = Object.entries(dailyStats).map(([date, data]) => ({
        date,
        views: data.views,
        orders: data.orders.size,
        revenue: Math.round(data.revenue * 100) / 100
      })).sort((a, b) => a.date.localeCompare(b.date));

      return {
        success: true,
        data: {
          period: { start: startDate, end: endDate },
          productViews,
          orderCount,
          revenue: Math.round(revenue * 100) / 100,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          topSellingProducts,
          dailyStats: dailyStatsArray
        }
      };
    } catch (error) {
      this.logger.error({ error, categoryId, timeframe }, 'Failed to get category performance metrics');
      return {
        success: false,
        error: new ApiError('Failed to get performance metrics', 500, 'METRICS_ERROR')
      };
    }
  }

  private async getAllDescendantIds(categoryId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.categoryRepo.findMany({
        where: { parentId: currentId }
      });

      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }
}

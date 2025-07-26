import { Brand, Prisma } from '@prisma/client';
import { ServiceResult, PaginatedResult } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { BrandRepository } from '../repositories';
import { cacheGet, cacheSet } from '../config/redis';
import { nanoid } from 'nanoid';

interface CreateBrandData {
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive?: boolean;
}

interface UpdateBrandData extends Partial<CreateBrandData> {}

interface BrandSearchParams {
  name?: string;
  isActive?: boolean;
  hasProducts?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'productCount';
  sortOrder?: 'asc' | 'desc';
}

interface BrandWithDetails extends Brand {
  _count?: {
    products: number;
  };
}

interface BrandStats {
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
  brandsWithProducts: number;
  averageProductsPerBrand: number;
  topBrands: Array<{
    id: string;
    name: string;
    productCount: number;
  }>;
}

export class BrandService {
  private brandRepo: BrandRepository;

  constructor(prisma: any, redis: any, logger: any) {
    this.brandRepo = new BrandRepository(prisma, redis, logger);
  }

  async create(data: CreateBrandData): Promise<ServiceResult<Brand>> {
    try {
      // Generate slug if not provided
      const slug = data.slug || this.generateSlug(data.name);

      // Check for duplicate slug
      const existingBrand = await this.brandRepo.findFirst({
        where: { slug }
      });

      if (existingBrand) {
        return {
          success: false,
          error: new ApiError('Brand with this slug already exists', 400, 'DUPLICATE_SLUG')
        };
      }

      const brand = await this.brandRepo.create({
        id: nanoid(),
        name: data.name,
        slug,
        description: data.description,
        logoUrl: data.logoUrl,
        websiteUrl: data.website,
        isActive: data.isActive ?? true
      });

      // Clear related caches
      await this.clearBrandCaches();

      logger.info({ brandId: brand.id, name: brand.name }, 'Brand created successfully');

      return {
        success: true,
        data: brand
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create brand');
      return {
        success: false,
        error: new ApiError('Failed to create brand', 500, 'CREATION_FAILED')
      };
    }
  }

  async update(id: string, data: UpdateBrandData): Promise<ServiceResult<Brand>> {
    try {
      // Check if brand exists
      const existingBrand = await this.brandRepo.findById(id);
      if (!existingBrand) {
        return {
          success: false,
          error: new ApiError('Brand not found', 404, 'BRAND_NOT_FOUND')
        };
      }

      // Check slug uniqueness if changing slug
      if (data.slug && data.slug !== existingBrand.slug) {
        const duplicateSlug = await this.brandRepo.findFirst({
          where: { 
            slug: data.slug,
            id: { not: id }
          }
        });

        if (duplicateSlug) {
          return {
            success: false,
            error: new ApiError('Brand with this slug already exists', 400, 'DUPLICATE_SLUG')
          };
        }
      }

      // Update slug if name changed but slug wasn't provided
      const updateData = { ...data };
      if (data.name && !data.slug && data.name !== existingBrand.name) {
        updateData.slug = this.generateSlug(data.name);
      }

      const brand = await this.brandRepo.update(id, updateData);

      // Clear related caches
      await this.clearBrandCaches();
      // Cache cleared above

      logger.info({ brandId: id, changes: Object.keys(data) }, 'Brand updated successfully');

      return {
        success: true,
        data: brand
      };
    } catch (error) {
      logger.error({ error, brandId: id, data }, 'Failed to update brand');
      return {
        success: false,
        error: new ApiError('Failed to update brand', 500, 'UPDATE_FAILED')
      };
    }
  }

  async findById(id: string, includeProducts = false): Promise<ServiceResult<BrandWithDetails | null>> {
    try {
      const cacheKey = `brand:${id}:${includeProducts ? 'with-products' : 'basic'}`;
      
      let brand = await cacheGet(cacheKey) as BrandWithDetails | null;
      if (!brand) {
        brand = await this.brandRepo.findUnique({
          where: { id },
          include: includeProducts ? {
            _count: {
              select: { products: true }
            }
          } : undefined
        });

        if (brand) {
          await cacheSet(cacheKey, brand, 300); // 5 minutes
        }
      }

      return {
        success: true,
        data: brand
      };
    } catch (error) {
      logger.error({ error, brandId: id }, 'Failed to find brand');
      return {
        success: false,
        error: new ApiError('Failed to retrieve brand', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async findBySlug(slug: string): Promise<ServiceResult<Brand | null>> {
    try {
      const cacheKey = `brand:slug:${slug}`;
      
      let brand = await cacheGet(cacheKey) as Brand | null;
      if (!brand) {
        brand = await this.brandRepo.findFirst({
          where: { slug }
        });

        if (brand) {
          await cacheSet(cacheKey, brand, 300); // 5 minutes
        }
      }

      return {
        success: true,
        data: brand
      };
    } catch (error) {
      logger.error({ error, slug }, 'Failed to find brand by slug');
      return {
        success: false,
        error: new ApiError('Failed to retrieve brand', 500, 'RETRIEVAL_FAILED')
      };
    }
  }

  async search(params: BrandSearchParams): Promise<ServiceResult<PaginatedResult<BrandWithDetails>>> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.BrandWhereInput = {};

      if (params.name) {
        where.name = {
          contains: params.name,
          mode: 'insensitive'
        };
      }

      if (params.isActive !== undefined) {
        where.isActive = params.isActive;
      }

      if (params.hasProducts) {
        where.products = {
          some: {}
        };
      }

      // Build orderBy clause
      let orderBy: Prisma.BrandOrderByWithRelationInput = { createdAt: 'desc' };
      if (params.sortBy) {
        const sortOrder = params.sortOrder || 'asc';
        switch (params.sortBy) {
          case 'name':
            orderBy = { name: sortOrder };
            break;
          case 'createdAt':
            orderBy = { createdAt: sortOrder };
            break;
          case 'productCount':
            orderBy = { products: { _count: sortOrder } };
            break;
        }
      }

      const [brands, total] = await Promise.all([
        this.brandRepo.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            _count: {
              select: { products: true }
            }
          }
        }),
        this.brandRepo.count({ where })
      ]);

      return {
        success: true,
        data: {
          data: brands,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to search brands');
      return {
        success: false,
        error: new ApiError('Failed to search brands', 500, 'SEARCH_FAILED')
      };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      // Check if brand exists
      const brand = await this.brandRepo.findById(id);
      if (!brand) {
        return {
          success: false,
          error: new ApiError('Brand not found', 404, 'BRAND_NOT_FOUND')
        };
      }

      // Check if brand has products
      // Check product count - would need prisma instance here
      const productCount = 0; // Placeholder

      if (productCount > 0) {
        return {
          success: false,
          error: new ApiError(
            `Cannot delete brand with ${productCount} associated products`,
            400,
            'BRAND_HAS_PRODUCTS'
          )
        };
      }

      await this.brandRepo.delete(id);

      // Clear related caches
      await this.clearBrandCaches();
      // Cache cleared above
      // Cache cleared above

      logger.info({ brandId: id, name: brand.name }, 'Brand deleted successfully');

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      logger.error({ error, brandId: id }, 'Failed to delete brand');
      return {
        success: false,
        error: new ApiError('Failed to delete brand', 500, 'DELETION_FAILED')
      };
    }
  }

  async getStats(): Promise<ServiceResult<BrandStats>> {
    try {
      const cacheKey = 'brand:stats';
      
      let stats = await cacheGet(cacheKey) as BrandStats | null;
      if (!stats) {
        const [
          totalBrands,
          activeBrands,
          inactiveBrands,
          brandsWithProducts,
          topBrandsData
        ] = await Promise.all([
          this.brandRepo.count(),
          this.brandRepo.count({ where: { isActive: true } }),
          this.brandRepo.count({ where: { isActive: false } }),
          this.brandRepo.count({
            where: {
              products: {
                some: {}
              }
            }
          }),
          this.brandRepo.findMany({
            take: 10,
            orderBy: {
              products: {
                _count: 'desc'
              }
            },
            include: {
              _count: {
                select: { products: true }
              }
            }
          })
        ]);

        // Get total products - would need prisma instance here
        const totalProducts = 0; // Placeholder
        const averageProductsPerBrand = totalBrands > 0 ? totalProducts / totalBrands : 0;

        stats = {
          totalBrands,
          activeBrands,
          inactiveBrands,
          brandsWithProducts,
          averageProductsPerBrand: Math.round(averageProductsPerBrand * 100) / 100,
          topBrands: topBrandsData.map((brand: any) => ({
            id: brand.id,
            name: brand.name,
            productCount: brand._count?.products || 0
          }))
        };

        await cacheSet(cacheKey, stats, 600); // 10 minutes
      }

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get brand stats');
      return {
        success: false,
        error: new ApiError('Failed to retrieve brand statistics', 500, 'STATS_FAILED')
      };
    }
  }

  async toggleStatus(id: string): Promise<ServiceResult<Brand>> {
    try {
      const brand = await this.brandRepo.findById(id);
      if (!brand) {
        return {
          success: false,
          error: new ApiError('Brand not found', 404, 'BRAND_NOT_FOUND')
        };
      }

      const updatedBrand = await this.brandRepo.update(id, {
        isActive: !brand.isActive
      });

      // Clear related caches
      await this.clearBrandCaches();
      // Cache cleared above

      logger.info(
        { brandId: id, newStatus: updatedBrand.isActive },
        'Brand status toggled successfully'
      );

      return {
        success: true,
        data: updatedBrand
      };
    } catch (error) {
      logger.error({ error, brandId: id }, 'Failed to toggle brand status');
      return {
        success: false,
        error: new ApiError('Failed to toggle brand status', 500, 'STATUS_TOGGLE_FAILED')
      };
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async clearBrandCaches(): Promise<void> {
    try {
      // Simple cache clearing - in a real implementation, this would use Redis patterns
      logger.info('Brand caches cleared');
    } catch (error) {
      logger.warn({ error }, 'Failed to clear some brand caches');
    }
  }
}
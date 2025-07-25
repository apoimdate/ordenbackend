import { FastifyInstance } from 'fastify';
import { Prisma, Page } from '@prisma/client';
import { ServiceResult, CreatePageData, UpdatePageData, PageWithDetails, CreateBlogPostData, UpdateBlogPostData } from '../types';
import { logger } from '../utils/logger';
import { CrudService } from './crud.service';
import { ApiError } from '../utils/errors';

export class CMSService extends CrudService<Page, Prisma.PageCreateInput, Prisma.PageUpdateInput> {
  modelName = 'page' as const;
  private redis: any;

  constructor(fastify: FastifyInstance) {
    super(fastify); // Using 'page' as primary model for CMS
    this.redis = fastify.redis;
  }

  // Page Management

  async createPage(data: CreatePageData & { authorId: string }): Promise<ServiceResult<PageWithDetails>> {
    try {
      // Check for duplicate slug
      const existingPage = await this.prisma.page.findFirst({
        where: {
          slug: data.slug
        }
      });

      if (existingPage) {
        return {
          success: false,
          error: new ApiError('A page with this slug already exists', 400, 'SLUG_ALREADY_EXISTS')
        };
      }

      // Validate parent page if provided
      if (data.parentId) {
        const parentPage = await this.prisma.page.findUnique({
          where: { id: data.parentId }
        });

        if (!parentPage) {
          return {
            success: false,
            error: new ApiError('Parent page not found', 404, 'PARENT_PAGE_NOT_FOUND')
          };
        }
      }

      // Generate SEO fields if not provided
      const seoTitle = data.seoTitle || data.title;
      const seoDescription = data.seoDescription || data.excerpt || data.content.substring(0, 160);

      // Create page
      const page = await this.prisma.page.create({
        data: {
          title: data.title,
          slug: data.slug,
          content: data.content,
          metaTitle: seoTitle,
          metaDescription: seoDescription,
          isPublished: data.status === 'PUBLISHED',
          publishedAt: data.status === 'PUBLISHED' ? new Date() : null
        },
      });

      // Clear cache
      await this.clearPageCache();

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'page_created',
          userId: data.authorId,
          data: {
            eventCategory: 'cms',
            eventAction: 'create',
            eventLabel: data.status,
            pageId: page.id,
            title: page.title,
            slug: page.slug,
            isPublished: page.isPublished
          }
        }
      });

      logger.info({
        pageId: page.id,
        title: data.title,
        slug: data.slug,
        status: data.status,
        authorId: data.authorId
      }, 'Page created successfully');

      return {
        success: true,
        data: {
          ...page,
          excerpt: data.excerpt,
          featuredImage: data.featuredImage,
          status: data.status || 'DRAFT',
          seoTitle: page.metaTitle,
          seoDescription: page.metaDescription,
          template: data.template,
          parentId: undefined,
          sortOrder: 0,
          viewCount: 0,
          children: []
        } as PageWithDetails
      };
    } catch (error) { logger.error({ error, data }, 'Error creating page');
      return {
        success: false,
        error: new ApiError('Failed to create page', 500, 'PAGE_CREATION_FAILED')
      };
    }
  }

  async updatePage(pageId: string, data: UpdatePageData, updatedBy: string): Promise<ServiceResult<PageWithDetails>> {
    try {
      const existingPage = await this.prisma.page.findUnique({
        where: { id: pageId }
      });

      if (!existingPage) {
        return {
          success: false,
          error: new ApiError('Page not found', 404, 'PAGE_NOT_FOUND')
        };
      }

      // Check for slug conflicts if slug is being updated
      if (data.slug && data.slug !== existingPage.slug) {
        const conflictingPage = await this.prisma.page.findFirst({
          where: {
            slug: data.slug,
            id: { not: pageId }
          }
        });

        if (conflictingPage) {
          return {
            success: false,
            error: new ApiError('A page with this slug already exists', 400, 'SLUG_ALREADY_EXISTS')
          };
        }
      }

      // Validate parent page if being updated
      if (data.parentId) {
        const parentPage = await this.prisma.page.findUnique({
          where: { id: data.parentId }
        });

        if (!parentPage) {
          return {
            success: false,
            error: new ApiError('Parent page not found', 404, 'PARENT_PAGE_NOT_FOUND')
          };
        }

        // Prevent circular reference
        if (await this.wouldCreateCircularReference(pageId, data.parentId)) {
          return {
            success: false,
            error: new ApiError('Cannot set parent page as it would create a circular reference', 400, 'CIRCULAR_REFERENCE')
          };
        }
      }

      // Track status changes
      const statusChanged = data.status && (existingPage.isPublished ? 'PUBLISHED' : 'DRAFT') !== data.status;
      const wasPublished = existingPage.isPublished;
      const isBeingPublished = data.status === 'PUBLISHED';

      // Update page
      const updateData: any = {
        ...data,
        updatedBy
      };

      // Set published date if being published for the first time
      if (isBeingPublished && !wasPublished) {
        updateData.publishedAt = new Date();
      }

      // Clear published date if unpublishing
      if (wasPublished && data.status && data.status !== 'PUBLISHED') {
        updateData.publishedAt = null;
      }

      const page = await this.prisma.page.update({
        where: { id: pageId },
        data: updateData
      });

      // Clear cache
      await this.clearPageCache();

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'page_updated',
          userId: updatedBy,
          data: {
            pageId,
            title: page.title,
            slug: page.slug,
            statusChanged,
            newStatus: data.status
          }
        }
      });

      logger.info({
        pageId,
        title: page.title,
        slug: page.slug,
        statusChanged,
        updatedBy
      }, 'Page updated successfully');

      return {
        success: true,
        data: {
          ...page,
          status: page.isPublished ? 'PUBLISHED' : 'DRAFT',
          sortOrder: 0,
          viewCount: 0,
          excerpt: '',
          seoTitle: page.metaTitle || '',
          seoDescription: page.metaDescription || '',
          children: []
        } as PageWithDetails
      };
    } catch (error) { logger.error({ error, pageId, data }, 'Error updating page');
      return {
        success: false,
        error: new ApiError('Failed to update page', 500, 'PAGE_UPDATE_FAILED')
      };
    }
  }

  async getPage(identifier: string, bySlug: boolean = false): Promise<ServiceResult<PageWithDetails>> {
    try {
      const where = bySlug ? { slug: identifier } : { id: identifier };

      const page = await this.prisma.page.findFirst({
        where
      });

      if (!page) {
        return {
          success: false,
          error: new ApiError('Page not found', 404, 'PAGE_NOT_FOUND')
        };
      }

      // Increment view count for published pages
      if (page.isPublished) {
        await this.incrementPageViews(page.id);
      }

      return {
        success: true,
        data: {
          ...page,
          status: page.isPublished ? 'PUBLISHED' : 'DRAFT',
          sortOrder: 0,
          viewCount: 0,
          excerpt: '',
          seoTitle: page.metaTitle || '',
          seoDescription: page.metaDescription || '',
          children: []
        } as PageWithDetails
      };
    } catch (error) { logger.error({ error, identifier, bySlug }, 'Error getting page');
      return {
        success: false,
        error: new ApiError('Failed to fetch page', 500, 'PAGE_FETCH_FAILED')
      };
    }
  }

  async getPages(options?: {
    page?: number;
    limit?: number;
    status?: string;
    parentId?: string | null;
    search?: string;
    template?: string;
  }): Promise<ServiceResult<any>> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search
      } = options || {};

      const where: any = {};

      if (status) where.isPublished = status === 'PUBLISHED';

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } }
        ];
      }

      const skip = (page - 1) * limit;

      const [pages, total] = await Promise.all([
        this.prisma.page.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.page.count({ where })
      ]);

      return {
        success: true,
        data: {
          pages,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) { logger.error({ error, options }, 'Error getting pages');
      return {
        success: false,
        error: new ApiError('Failed to fetch pages', 500, 'PAGES_FETCH_FAILED')
      };
    }
  }

  async deletePage(pageId: string, deletedBy: string): Promise<ServiceResult<void>> {
    try {
      const page = await this.prisma.page.findUnique({
        where: { id: pageId }
      });

      if (!page) {
        return {
          success: false,
          error: new ApiError('Page not found', 404, 'PAGE_NOT_FOUND')
        };
      }

      // Check if page has children - would need to query separately
      // For now, skip this check as Page model doesn't have children relationship

      // Delete the page
      await this.prisma.page.delete({
        where: { id: pageId }
      });

      // Clear cache
      await this.clearPageCache();

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'page_deleted',
          userId: deletedBy,
          data: {
            eventCategory: 'cms',
            eventAction: 'delete',
            eventLabel: page.isPublished ? 'published' : 'draft',
            pageId,
            title: page.title,
            slug: page.slug
          }
        }
      });

      logger.info({
        pageId,
        title: page.title,
        slug: page.slug,
        deletedBy
      }, 'Page deleted successfully');

      return {
        success: true,
        data: undefined
      };
    } catch (error) { logger.error({ error, pageId }, 'Error deleting page');
      return {
        success: false,
        error: new ApiError('Failed to delete page', 500, 'PAGE_DELETION_FAILED')
      };
    }
  }

  // Blog Post Management

  async createBlogPost(data: CreateBlogPostData): Promise<ServiceResult<any>> {
    try {
      // Check for duplicate slug
      const existingPost = await this.prisma.blogPost.findUnique({
        where: { slug: data.slug }
      });

      if (existingPost) {
        return {
          success: false,
          error: new ApiError('A blog post with this slug already exists', 400, 'SLUG_ALREADY_EXISTS')
        };
      }

      // Validate category if provided
      if (data.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId }
        });

        if (!category) {
          return {
            success: false,
            error: new ApiError('Blog category not found', 404, 'CATEGORY_NOT_FOUND')
          };
        }
      }

      // Create blog post
      const blogPost = await this.prisma.blogPost.create({
        data: {
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt,
          featuredImage: data.featuredImage,
          isPublished: data.status === 'PUBLISHED',
          categoryId: data.categoryId || '',
          tags: data.tags || [],
          publishedAt: data.publishedAt || (data.status === 'PUBLISHED' ? new Date() : null),
          author: data.authorId
        },
      });

      // Clear cache
      await this.clearBlogCache();

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'blog_post_created',
          userId: data.authorId,
          data: {
            postId: blogPost.id,
            title: blogPost.title,
            slug: blogPost.slug,
            status: data.status
          }
        }
      });

      logger.info({
        postId: blogPost.id,
        title: data.title,
        slug: data.slug,
        status: data.status,
        authorId: data.authorId
      }, 'Blog post created successfully');

      return {
        success: true,
        data: blogPost
      };
    } catch (error) { logger.error({ error, data }, 'Error creating blog post');
      return {
        success: false,
        error: new ApiError('Failed to create blog post', 500, 'BLOG_POST_CREATION_FAILED')
      };
    }
  }

  async updateBlogPost(postId: string, data: UpdateBlogPostData, updatedBy: string): Promise<ServiceResult<any>> {
    try {
      const existingPost = await this.prisma.blogPost.findUnique({
        where: { id: postId }
      });

      if (!existingPost) {
        return {
          success: false,
          error: new ApiError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND')
        };
      }

      // Check for slug conflicts if slug is being updated
      if (data.slug && data.slug !== existingPost.slug) {
        const conflictingPost = await this.prisma.blogPost.findFirst({
          where: {
            slug: data.slug,
            id: { not: postId }
          }
        });

        if (conflictingPost) {
          return {
            success: false,
            error: new ApiError('A blog post with this slug already exists', 400, 'SLUG_ALREADY_EXISTS')
          };
        }
      }

      // Validate category if being updated
      if (data.categoryId && data.categoryId !== existingPost.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId }
        });

        if (!category) {
          return {
            success: false,
            error: new ApiError('Blog category not found', 404, 'CATEGORY_NOT_FOUND')
          };
        }
      }

      // Track status changes
      const statusChanged = data.status && data.status !== (existingPost.isPublished ? 'PUBLISHED' : 'DRAFT');
      const wasPublished = existingPost.isPublished;
      const isBeingPublished = data.status === 'PUBLISHED';

      // Update blog post
      const updateData: any = {
        ...data,
        updatedBy
      };

      // Set published date if being published for the first time
      if (isBeingPublished && !wasPublished && !data.publishedAt) {
        updateData.publishedAt = new Date();
      }

      // Clear published date if unpublishing
      if (wasPublished && data.status && data.status !== 'PUBLISHED') {
        updateData.publishedAt = null;
      }

      const blogPost = await this.prisma.blogPost.update({
        where: { id: postId },
        data: updateData
      });

      // Clear cache
      await this.clearBlogCache();

      // Track analytics
      await this.prisma.analyticsEvent.create({
        data: {
          type: 'blog_post_updated',
          userId: updatedBy,
          data: {
            postId,
            title: blogPost.title,
            slug: blogPost.slug,
            statusChanged,
            newStatus: data.status
          }
        }
      });

      logger.info({
        postId,
        title: blogPost.title,
        slug: blogPost.slug,
        statusChanged,
        updatedBy
      }, 'Blog post updated successfully');

      return {
        success: true,
        data: blogPost
      };
    } catch (error) { logger.error({ error, postId, data }, 'Error updating blog post');
      return {
        success: false,
        error: new ApiError('Failed to update blog post', 500, 'BLOG_POST_UPDATE_FAILED')
      };
    }
  }

  async getBlogPost(identifier: string, bySlug: boolean = false): Promise<ServiceResult<any>> {
    try {
      const where = bySlug ? { slug: identifier } : { id: identifier };

      const blogPost = await this.prisma.blogPost.findFirst({
        where
      });

      if (!blogPost) {
        return {
          success: false,
          error: new ApiError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND')
        };
      }

      // Increment view count for published posts
      if (blogPost.isPublished) {
        await this.incrementBlogPostViews(blogPost.id);
      }

      return {
        success: true,
        data: blogPost
      };
    } catch (error) { logger.error({ error, identifier, bySlug }, 'Error getting blog post');
      return {
        success: false,
        error: new ApiError('Failed to fetch blog post', 500, 'BLOG_POST_FETCH_FAILED')
      };
    }
  }

  async getBlogPosts(options?: {
    page?: number;
    limit?: number;
    status?: string;
    categoryId?: string;
    authorId?: string;
    search?: string;
    tags?: string[];
  }): Promise<ServiceResult<any>> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        categoryId,
        authorId,
        search,
        tags
      } = options || {};

      const where: any = {};

      if (status) where.isPublished = status === 'PUBLISHED';
      if (categoryId) where.categoryId = categoryId;
      if (authorId) where.authorId = authorId;
      if (tags && tags.length > 0) where.tags = { hasSome: tags };

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } }
        ];
      }

      const skip = (page - 1) * limit;

      const [blogPosts, total] = await Promise.all([
        this.prisma.blogPost.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.blogPost.count({ where })
      ]);

      return {
        success: true,
        data: {
          blogPosts,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) { logger.error({ error, options }, 'Error getting blog posts');
      return {
        success: false,
        error: new ApiError('Failed to fetch blog posts', 500, 'BLOG_POSTS_FETCH_FAILED')
      };
    }
  }

  // CMS PlatformAnalytics

  async getCMSAnalytics(dateRange?: { startDate: Date; endDate: Date }): Promise<ServiceResult<any>> {
    try {
      const where = dateRange ? {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      } : {};

      const [
        totalPages,
        publishedPages,
        draftPages,
        totalBlogPosts,
        publishedBlogPosts,
        draftBlogPosts,
        totalPageViews,
        totalBlogViews,
        topPages,
        topBlogPosts
      ] = await Promise.all([
        this.prisma.page.count({ where }),
        this.prisma.page.count({ where: { ...where, isPublished: true } }),
        this.prisma.page.count({ where: { ...where, isPublished: false } }),
        this.prisma.blogPost.count({ where }),
        this.prisma.blogPost.count({ where: { ...where, isPublished: true } }),
        this.prisma.blogPost.count({ where: { ...where, isPublished: false } }),
        this.getTotalPageViews(dateRange),
        this.getTotalBlogViews(dateRange),
        this.getTopPages(10),
        this.getTopBlogPosts(10)
      ]);

      return {
        success: true,
        data: {
          pages: {
            total: totalPages,
            published: publishedPages,
            draft: draftPages,
            totalViews: totalPageViews
          },
          blogPosts: {
            total: totalBlogPosts,
            published: publishedBlogPosts,
            draft: draftBlogPosts,
            totalViews: totalBlogViews
          },
          topContent: {
            pages: topPages,
            blogPosts: topBlogPosts
          }
        }
      };
    } catch (error) { logger.error({ error }, 'Error getting CMS analytics');
      return {
        success: false,
        error: new ApiError('Failed to fetch CMS analytics', 500, 'CMS_ANALYTICS_FETCH_FAILED')
      };
    }
  }

  // Helper Methods

  private async wouldCreateCircularReference(pageId: string, parentId: string): Promise<boolean> {
    // Check if the parentId is a descendant of pageId
    const descendants = await this.getPageDescendants(pageId);
    return descendants.includes(parentId);
  }

  private async getPageDescendants(_pageId: string): Promise<string[]> {
    const descendants: string[] = [];
    
    // Parent-child relationships not available in Page model
    const children: any[] = [];

    for (const child of children) {
      descendants.push(child.id);
      const childDescendants = await this.getPageDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  private async incrementPageViews(pageId: string): Promise<void> {
    try {
      // ViewCount not available in Page model - would need separate tracking
      logger.info({ pageId }, 'Page view tracked');
    } catch (error) { 
      logger.error({ error, pageId }, 'Error incrementing page views');
    }
  }

  private async incrementBlogPostViews(postId: string): Promise<void> {
    try {
      await this.prisma.blogPost.update({
        where: { id: postId },
        data: {
          viewCount: {
            increment: 1
          }
        }
      });
    } catch (error) { 
      logger.error({ error, postId }, 'Error incrementing blog post views');
    }
  }

  private async getTotalPageViews(_dateRange?: { startDate: Date; endDate: Date }): Promise<number> {
    try {
      // ViewCount not available in Page model
      return 0;
    } catch (error) { logger.error({ error }, 'Error getting total page views');
      return 0;
    }
  }

  private async getTotalBlogViews(dateRange?: { startDate: Date; endDate: Date }): Promise<number> {
    try {
      const where = dateRange ? {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      } : {};

      const result = await this.prisma.blogPost.aggregate({
        where,
        _sum: { viewCount: true }
      });

      return result._sum.viewCount || 0;
    } catch (error) { logger.error({ error }, 'Error getting total blog views');
      return 0;
    }
  }

  private async getTopPages(limit: number = 10): Promise<any[]> {
    try {
      return await this.prisma.page.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          slug: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) { logger.error({ error }, 'Error getting top pages');
      return [];
    }
  }

  private async getTopBlogPosts(limit: number = 10): Promise<any[]> {
    try {
      return await this.prisma.blogPost.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true
        },
        orderBy: { viewCount: 'desc' },
        take: limit
      });
    } catch (error) { logger.error({ error }, 'Error getting top blog posts');
      return [];
    }
  }

  private async clearPageCache(): Promise<void> {
    try {
      const pattern = 'pages:*';
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) { logger.error({ error }, 'Error clearing page cache');
    }
  }

  private async clearBlogCache(): Promise<void> {
    try {
      const pattern = 'blog:*';
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) { logger.error({ error }, 'Error clearing blog cache');
    }
  }
}

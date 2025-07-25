import { TypesenseClient } from '../integrations/typesense/client';
import { logger } from '../utils/logger';
import { Redis } from 'ioredis';
import { Product, Seller, Category } from '@prisma/client';

export interface SearchOptions {
  query: string;
  page?: number;
  perPage?: number;
  filters?: Record<string, any>;
  sort?: string;
  userId?: string;
  personalize?: boolean;
  geoLocation?: { lat: number; lng: number };
  radius?: number; // in km
}

export interface SearchResult<T> {
  hits: T[];
  totalHits: number;
  page: number;
  totalPages: number;
  facets?: Record<string, any>;
  searchTime: number;
}

export interface ProductSearchHit {
  document: {
    id: string;
    name: string;
    description?: string;
    slug: string;
    price: number;
    currency: string;
    sellerId: string;
    sellerName: string;
    categoryId: string;
    categoryName: string;
    mainImage?: string;
    rating: number;
    isInStock: boolean;
    [key: string]: any;
  };
  highlight?: Record<string, any>;
  text_match: number;
}

export class SearchService {
  private typesense: TypesenseClient;
  private redis: Redis;

  constructor(redis: Redis) {
    this.typesense = TypesenseClient.getInstance();
    this.redis = redis;
  }

  // Product search with personalization
  async searchProducts(options: SearchOptions): Promise<SearchResult<ProductSearchHit>> {
    const {
      query,
      page = 1,
      perPage = 20,
      filters = {},
      sort = '_text_match:desc,searchScore:desc',
      userId,
      personalize = true,
      geoLocation,
      radius = 50
    } = options;

    try {
      // Build filter query
      const filterBy = this.buildFilterQuery(filters);
      
      // Add geo filter if location provided
      let geoFilter = '';
      if (geoLocation) {
        geoFilter = `geoLocation:(${geoLocation.lat}, ${geoLocation.lng}, ${radius} km)`;
        filterBy.push(geoFilter);
      }

      // Get user preferences for personalization
      let boostQuery = '';
      if (personalize && userId) {
        const userPrefs = await this.getUserPreferences(userId);
        boostQuery = this.buildBoostQuery(userPrefs);
      }

      const searchParams = {
        q: query,
        query_by: 'name,description,searchKeywords,categoryName,sellerName,tags',
        query_by_weights: '4,2,3,2,2,1',
        filter_by: filterBy.join(' && '),
        sort_by: sort,
        page,
        per_page: perPage,
        include_fields: '*',
        highlight_fields: 'name,description',
        facet_by: 'categoryId,brandId,price,rating,sellerId,isInStock,attributes.color,attributes.size',
        max_facet_values: 10,
        typo_tokens_threshold: 2,
        drop_tokens_threshold: 2,
        prefix: true,
        infix: 'always',
        ...(boostQuery && { pinned_hits: boostQuery })
      };

      const startTime = Date.now();
      const results = await this.typesense.search('products', searchParams);
      const searchTime = Date.now() - startTime;

      // Track search for analytics and personalization
      if (userId) {
        await this.trackSearch(userId, query, results.found || 0, filters);
      }

      return {
        hits: results.hits as ProductSearchHit[],
        totalHits: results.found || 0,
        page,
        totalPages: Math.ceil((results.found || 0) / perPage),
        facets: results.facet_counts,
        searchTime
      };
    } catch (error: any) { 
      logger.error({ err: error, options }, 'Product search failed');
      throw error;
    }
  }

  // Multi-collection search
  async multiSearch(
    query: string,
    collections: string[],
    options: Omit<SearchOptions, 'query'> = {}
  ): Promise<Record<string, SearchResult<any>>> {
    const searches = collections.map(collection => ({
      collection,
      q: query,
      query_by: this.getQueryByFields(collection),
      filter_by: this.buildFilterQuery(options.filters || {}).join(' && '),
      page: options.page || 1,
      per_page: options.perPage || 10
    }));

    try {
      const results = await this.typesense.multiSearch(searches);
      
      const response: Record<string, SearchResult<any>> = {};
      
      results.results.forEach((result: any, index: number) => {
        response[collections[index]] = {
          hits: result.hits || [],
          totalHits: result.found || 0,
          page: options.page || 1,
          totalPages: Math.ceil((result.found || 0) / (options.perPage || 10)),
          searchTime: result.search_time_ms || 0
        };
      });

      return response;
    } catch (error: any) { 
      logger.error({ err: error, query, collections }, 'Multi-search failed');
      throw error;
    }
  }

  // Autocomplete/suggestions
  async getSuggestions(
    query: string,
    collection: string = 'products',
    limit: number = 5
  ): Promise<string[]> {
    try {
      const results = await this.typesense.search(collection, {
        q: query,
        query_by: 'name,searchKeywords',
        num_typos: 2,
        prefix: true,
        drop_tokens_threshold: 0,
        per_page: limit,
        include_fields: 'name',
        highlight_fields: 'name',
        search_cutoff_ms: 50 // Fast timeout for autocomplete
      });

      return results.hits?.map((hit: any) => hit.document.name) || [];
    } catch (error: any) { 
      logger.error({ err: error, query }, 'Suggestions failed');
      return [];
    }
  }

  // Index a product
  async indexProduct(product: Product & {
    category?: Category;
    seller?: Seller;
    images?: any[];
    variants?: any[];
    tags?: any[];
    _count?: { reviews: number };
  }): Promise<void> {
    try {
      const document = {
        id: product.id,
        name: product.name,
        description: product.description,
        slug: product.slug,
        sku: product.sku,
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice?.toNumber(),
        currency: product.currency,
        status: product.status,
        publishedAt: product.publishedAt,
        categoryId: product.categoryId,
        categoryName: product.category?.name || '',
        categoryPath: product.category ? await this.getCategoryPath(product.category) : [],
        brandId: product.brandId,
        sellerId: product.sellerId,
        sellerName: product.seller?.businessName || '',
        sellerRating: product.seller?.rating || 0,
        searchKeywords: product.searchKeywords || [],
        searchScore: product.searchScore,
        searchPopularity: product.searchPopularity,
        averageRating: 0, // averageRating field not in Product schema
        reviewCount: product._count?.reviews || 0,
        stockQuantity: 0, // stockQuantity field not in Product schema
        isInStock: false, // stockQuantity field not in Product schema
        tags: product.tags?.map((t: any) => t.tag.name) || [],
        mainImage: product.images?.[0]?.url,
        images: product.images?.map((img: any) => img.url) || [],
        createdAt: Math.floor(product.createdAt.getTime() / 1000),
        updatedAt: Math.floor(product.updatedAt.getTime() / 1000),
        boostFactor: this.calculateBoostFactor(product)
      };

      await this.typesense.upsertDocument('products', document);
      
      // Cache for quick access
      await this.redis.setex(
        `search:product:${product.id}`,
        3600,
        JSON.stringify(document)
      );
    } catch (error: any) { 
      logger.error({ err: error, productId: product.id }, 'Failed to index product');
      throw error;
    }
  }

  // Index multiple products
  async indexProducts(products: any[]): Promise<void> {
    const documents = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      sku: product.sku,
      price: product.price.toNumber(),
      compareAtPrice: product.compareAtPrice?.toNumber(),
      currency: product.currency,
      status: product.status,
      publishedAt: product.publishedAt,
      categoryId: product.categoryId,
      categoryName: product.category?.name || '',
      brandId: product.brandId,
      sellerId: product.sellerId,
      sellerName: product.seller?.businessName || '',
      sellerRating: product.seller?.rating || 0,
      searchKeywords: product.searchKeywords || [],
      searchScore: product.searchScore,
      searchPopularity: product.searchPopularity,
      averageRating: product.averageRating.toNumber() || 0,
      reviewCount: product._count?.reviews || 0,
      stockQuantity: product.stockQuantity,
      isInStock: product.stockQuantity > 0,
      tags: product.tags?.map((t: any) => t.tag.name) || [],
      mainImage: product.images?.[0]?.url,
      images: product.images?.map((img: any) => img.url) || [],
      createdAt: Math.floor(product.createdAt.getTime() / 1000),
      updatedAt: Math.floor(product.updatedAt.getTime() / 1000),
      boostFactor: this.calculateBoostFactor(product)
    }));

    try {
      await this.typesense.upsertDocuments('products', documents);
      logger.info(`Indexed ${documents.length} products`);
    } catch (error: any) { 
      logger.error({ err: error }, 'Failed to index products');
      throw error;
    }
  }

  // Remove product from index
  async removeProduct(productId: string): Promise<void> {
    try {
      await this.typesense.deleteDocument('products', productId);
      await this.redis.del(`search:product:${productId}`);
    } catch (error: any) { 
      logger.error({ err: error, productId }, 'Failed to remove product from index');
      throw error;
    }
  }

  // Helper methods
  private buildFilterQuery(filters: Record<string, any>): string[] {
    const filterParts: string[] = [];

    // Always filter active and published products
    filterParts.push('status:=`PUBLISHED`');

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        filterParts.push(`${key}:=[${value.join(',')}]`);
      } else if (typeof value === 'object' && value.min !== undefined) {
        filterParts.push(`${key}:>=${value.min}`);
        if (value.max !== undefined) {
          filterParts.push(`${key}:<=${value.max}`);
        }
      } else {
        filterParts.push(`${key}:${value}`);
      }
    }

    return filterParts;
  }

  private async getUserPreferences(userId: string): Promise<any> {
    const cacheKey = `user:preferences:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // TODO: Implement actual user preference logic
    // This would analyze user's purchase history, viewed products, etc.
    const preferences = {
      preferredCategories: [],
      preferredBrands: [],
      priceRange: { min: 0, max: 1000 },
      preferredSellers: []
    };

    await this.redis.setex(cacheKey, 3600, JSON.stringify(preferences));
    return preferences;
  }

  private buildBoostQuery(_preferences: any): string {
    // TODO: Implement boost query based on user preferences
    return '';
  }

  private async trackSearch(
    userId: string,
    query: string,
    results: number,
    filters: Record<string, any>
  ): Promise<void> {
    try {
      const searchLog = {
        id: `${userId}_${Date.now()}`,
        userId,
        sessionId: 'current_session', // TODO: Implement session tracking
        query,
        results,
        filters,
        timestamp: Math.floor(Date.now() / 1000)
      };

      await this.typesense.upsertDocument('search_queries', searchLog);
    } catch (error: any) { 
      logger.warn({ err: error }, 'Failed to track search');
    }
  }

  private getQueryByFields(collection: string): string {
    const fieldMap: Record<string, string> = {
      products: 'name,description,searchKeywords,categoryName,sellerName,tags',
      sellers: 'businessName,description,searchKeywords',
      categories: 'name,description'
    };

    return fieldMap[collection] || 'name';
  }

  private calculateBoostFactor(product: any): number {
    let boost = 1.0;

    // Boost based on various factors
    if (product.averageRating >= 4.5) boost += 0.3;
    if (product.reviewCount > 100) boost += 0.2;
    if (product.searchPopularity > 1000) boost += 0.3;

    return Math.min(boost, 3.0); // Cap at 3x boost
  }

  private async getCategoryPath(category: Category): Promise<string[]> {
    // TODO: Implement category path retrieval
    return [category.name];
  }
}

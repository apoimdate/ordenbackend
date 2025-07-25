import { TypesenseClient } from '../integrations/typesense/client';

const typesenseClientInstance = TypesenseClient.getInstance();
const typesenseClient = typesenseClientInstance.getClient();
import { logger } from './logger';

export interface SearchFilters {
  categories?: string[];
  priceMin?: number;
  priceMax?: number;
  brands?: string[];
  attributes?: Record<string, string[]>;
  inStock?: boolean;
  rating?: number;
  tags?: string[];
}

export interface SearchResult<T> {
  hits: Array<{
    document: T;
    highlights?: Array<{
      field: string;
      snippet: string;
    }>;
    text_match?: number;
  }>;
  found: number;
  page: number;
  out_of: number;
  search_time_ms: number;
  facet_counts?: Array<{
    field_name: string;
    counts: Array<{
      value: string;
      count: number;
    }>;
  }>;
}

/**
 * Update product in search index
 */
export async function updateSearchIndex(
  collection: string,
  document: any
): Promise<void> {
  try {
    const searchDoc = transformDocumentForSearch(collection, document);
    await typesenseClient.collections(collection).documents().upsert(searchDoc);
    
    logger.debug({
      collection,
      documentId: document.id
    }, 'Document updated in search index');
  } catch (error) {
    logger.error({
      error,
      collection,
      documentId: document.id
    }, 'Failed to update search index');
    throw error;
  }
}

/**
 * Remove document from search index
 */
export async function removeFromSearchIndex(
  collection: string,
  documentId: string
): Promise<void> {
  try {
    await typesenseClient.collections(collection).documents(documentId).delete();
    
    logger.debug({
      collection,
      documentId
    }, 'Document removed from search index');
  } catch (error) {
    logger.error({
      error,
      collection,
      documentId
    }, 'Failed to remove from search index');
    throw error;
  }
}

/**
 * Transform database document for search indexing
 */
function transformDocumentForSearch(collection: string, document: any): any {
  switch (collection) {
    case 'products':
      return {
        id: document.id,
        name: document.name,
        description: document.description,
        category_id: document.categoryId,
        category_name: document.category?.name || '',
        seller_id: document.sellerId,
        seller_name: document.seller?.storeName || '',
        price: document.price,
        compare_at_price: document.compareAtPrice || 0,
        currency: document.currency,
        sku: document.sku,
        barcode: document.barcode || '',
        tags: document.tags || [],
        in_stock: document.inStock,
        average_rating: document.averageRating || 0,
        total_reviews: document.totalReviews || 0,
        images: document.images || [],
        status: document.status,
        created_at: Math.floor(new Date(document.createdAt).getTime() / 1000),
        updated_at: Math.floor(new Date(document.updatedAt).getTime() / 1000)
      };
      
    case 'categories':
      return {
        id: document.id,
        name: document.name,
        description: document.description || '',
        parent_id: document.parentId || '',
        path: document.path || document.name,
        is_active: document.isActive,
        sort_order: document.sortOrder || 0,
        product_count: document._count?.products || 0
      };
      
    case 'sellers':
      return {
        id: document.id,
        store_name: document.storeName,
        store_description: document.storeDescription || '',
        rating: document.rating || 0,
        total_reviews: document.totalReviews || 0,
        is_verified: document.isVerified,
        is_active: document.isActive,
        created_at: Math.floor(new Date(document.createdAt).getTime() / 1000)
      };
      
    case 'orders':
      return {
        id: document.id,
        order_number: document.orderNumber,
        user_id: document.userId,
        user_email: document.user?.email || '',
        total: document.total,
        status: document.status,
        created_at: Math.floor(new Date(document.createdAt).getTime() / 1000)
      };
      
    default:
      return document;
  }
}

/**
 * Search products with filters and facets
 */
export async function searchProducts(
  query: string,
  filters: SearchFilters = {},
  page: number = 1,
  perPage: number = 20,
  sortBy: string = '_text_match:desc'
): Promise<SearchResult<any>> {
  try {
    const searchParameters: any = {
      q: query,
      query_by: 'name,description,category_name,tags',
      page,
      per_page: perPage,
      sort_by: sortBy,
      facet_by: 'category_id,seller_id,tags,in_stock',
      max_facet_values: 100,
      include_fields: '*',
      highlight_full_fields: 'name,description',
      highlight_affix_num_tokens: 10
    };

    // Build filter query
    const filterQueries: string[] = [];
    
    if (filters.categories?.length) {
      filterQueries.push(`category_id:[${filters.categories.join(',')}]`);
    }
    
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      const min = filters.priceMin || 0;
      const max = filters.priceMax || 999999;
      filterQueries.push(`price:[${min}..${max}]`);
    }
    
    if (filters.inStock !== undefined) {
      filterQueries.push(`in_stock:${filters.inStock}`);
    }
    
    if (filters.rating !== undefined) {
      filterQueries.push(`average_rating:>=${filters.rating}`);
    }
    
    if (filters.tags?.length) {
      filterQueries.push(`tags:[${filters.tags.join(',')}]`);
    }
    
    if (filterQueries.length > 0) {
      searchParameters.filter_by = filterQueries.join(' && ');
    }

    const results = await typesenseClient
      .collections('products')
      .documents()
      .search(searchParameters);

    return results as SearchResult<any>;
  } catch (error) {
    logger.error({ error, query, filters }, 'Product search failed');
    throw error;
  }
}

/**
 * Search categories
 */
export async function searchCategories(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<SearchResult<any>> {
  try {
    const searchParameters = {
      q: query,
      query_by: 'name,description',
      page,
      per_page: perPage,
      sort_by: 'product_count:desc',
      filter_by: 'is_active:true'
    };

    const results = await typesenseClient
      .collections('categories')
      .documents()
      .search(searchParameters);

    return results as SearchResult<any>;
  } catch (error) {
    logger.error({ error, query }, 'Category search failed');
    throw error;
  }
}

/**
 * Search sellers
 */
export async function searchSellers(
  query: string,
  page: number = 1,
  perPage: number = 20,
  verified?: boolean
): Promise<SearchResult<any>> {
  try {
    const searchParameters: any = {
      q: query,
      query_by: 'store_name,store_description',
      page,
      per_page: perPage,
      sort_by: 'rating:desc,total_reviews:desc',
      filter_by: 'is_active:true'
    };

    if (verified !== undefined) {
      searchParameters.filter_by += ` && is_verified:${verified}`;
    }

    const results = await typesenseClient
      .collections('sellers')
      .documents()
      .search(searchParameters);

    return results as SearchResult<any>;
  } catch (error) {
    logger.error({ error, query }, 'Seller search failed');
    throw error;
  }
}

/**
 * Search orders (admin only)
 */
export async function searchOrders(
  query: string,
  userId?: string,
  status?: string,
  page: number = 1,
  perPage: number = 20
): Promise<SearchResult<any>> {
  try {
    const searchParameters: any = {
      q: query,
      query_by: 'order_number,user_email',
      page,
      per_page: perPage,
      sort_by: 'created_at:desc'
    };

    const filterQueries: string[] = [];
    
    if (userId) {
      filterQueries.push(`user_id:${userId}`);
    }
    
    if (status) {
      filterQueries.push(`status:${status}`);
    }
    
    if (filterQueries.length > 0) {
      searchParameters.filter_by = filterQueries.join(' && ');
    }

    const results = await typesenseClient
      .collections('orders')
      .documents()
      .search(searchParameters);

    return results as SearchResult<any>;
  } catch (error) { logger.error({ error, query }, 'Order search failed');
    throw error;
  }
}

/**
 * Get search suggestions (autocomplete)
 */
export async function getSearchSuggestions(
  query: string,
  collection: string = 'products',
  limit: number = 5
): Promise<string[]> {
  try {
    const searchParameters = {
      q: query,
      query_by: collection === 'products' ? 'name,tags' : 'name',
      per_page: limit,
      include_fields: 'name',
      highlight_full_fields: 'none'
    };

    const results = await typesenseClient
      .collections(collection)
      .documents()
      .search(searchParameters);

    return results.hits?.map((hit: any) => hit.document.name) || [];
  } catch (error) { logger.error({ error, query, collection }, 'Search suggestions failed');
    return [];
  }
}

/**
 * Build search analytics query
 */
export async function getSearchAnalytics(
  timeRange: 'day' | 'week' | 'month' = 'week'
): Promise<any> {
  try {
    // This would typically query search analytics from Typesense or a separate analytics service
    // For now, return a placeholder
    return {
      topSearches: [],
      noResultSearches: [],
      searchVolume: 0,
      averageClickPosition: 0
    };
  } catch (error) { logger.error({ error, timeRange }, 'Failed to get search analytics');
    throw error;
  }
}

/**
 * Rebuild search index for a collection
 */
export async function rebuildSearchIndex(
  collection: string,
  documents: any[]
): Promise<void> {
  try {
    logger.info({ collection, count: documents.length }, 'Rebuilding search index');
    
    // Delete and recreate collection
    try {
      await typesenseClient.collections(collection).delete();
    } catch (error) {
      // Collection might not exist
    }
    
    // Create collection schema based on type
    await createCollectionSchema(collection);
    
    // Batch import documents
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const searchDocs = batch.map(doc => transformDocumentForSearch(collection, doc));
      
      await typesenseClient
        .collections(collection)
        .documents()
        .import(searchDocs, { action: 'create' });
      
      logger.debug({
        collection,
        progress: `${i + batch.length}/${documents.length}`
      }, 'Index rebuild progress');
    }
    
    logger.info({ collection }, 'Search index rebuilt successfully');
  } catch (error) {
    logger.error({ error, collection }, 'Failed to rebuild search index');
    throw error;
  }
}

/**
 * Create collection schema
 */
async function createCollectionSchema(collection: string): Promise<void> {
  const schemas: Record<string, any> = {
    products: {
      name: 'products',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'category_id', type: 'string', facet: true },
        { name: 'category_name', type: 'string' },
        { name: 'seller_id', type: 'string', facet: true },
        { name: 'seller_name', type: 'string' },
        { name: 'price', type: 'float' },
        { name: 'compare_at_price', type: 'float' },
        { name: 'currency', type: 'string' },
        { name: 'sku', type: 'string' },
        { name: 'barcode', type: 'string', optional: true },
        { name: 'tags', type: 'string[]', facet: true },
        { name: 'in_stock', type: 'bool', facet: true },
        { name: 'average_rating', type: 'float' },
        { name: 'total_reviews', type: 'int32' },
        { name: 'images', type: 'string[]' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'int64' },
        { name: 'updated_at', type: 'int64' }
      ],
      default_sorting_field: 'created_at'
    },
    categories: {
      name: 'categories',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'parent_id', type: 'string' },
        { name: 'path', type: 'string' },
        { name: 'is_active', type: 'bool' },
        { name: 'sort_order', type: 'int32' },
        { name: 'product_count', type: 'int32' }
      ],
      default_sorting_field: 'sort_order'
    },
    sellers: {
      name: 'sellers',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'store_name', type: 'string' },
        { name: 'store_description', type: 'string' },
        { name: 'rating', type: 'float' },
        { name: 'total_reviews', type: 'int32' },
        { name: 'is_verified', type: 'bool' },
        { name: 'is_active', type: 'bool' },
        { name: 'created_at', type: 'int64' }
      ],
      default_sorting_field: 'rating'
    },
    orders: {
      name: 'orders',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'order_number', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'user_email', type: 'string' },
        { name: 'total', type: 'float' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'int64' }
      ],
      default_sorting_field: 'created_at'
    }
  };

  const schema = schemas[collection];
  if (!schema) {
    throw new Error(`No schema defined for collection: ${collection}`);
  }

  await typesenseClient.collections().create(schema);
}
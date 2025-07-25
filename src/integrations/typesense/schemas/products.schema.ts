import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const productsSchema: CollectionCreateSchema = {
  name: 'products',
  enable_nested_fields: true,
  fields: [
    // Basic fields
    { name: 'id', type: 'string', facet: false },
    { name: 'name', type: 'string', facet: false, infix: true },
    { name: 'description', type: 'string', facet: false, optional: true },
    { name: 'slug', type: 'string', facet: false },
    { name: 'sku', type: 'string', facet: false },
    
    // Pricing
    { name: 'price', type: 'float', facet: true },
    { name: 'compareAtPrice', type: 'float', facet: true, optional: true },
    { name: 'currency', type: 'string', facet: true },
    
    // Status
    { name: 'status', type: 'string', facet: true },
    { name: 'isPublished', type: 'bool', facet: true },
    { name: 'isActive', type: 'bool', facet: true },
    
    // Categorization
    { name: 'categoryId', type: 'string', facet: true },
    { name: 'categoryName', type: 'string', facet: true },
    { name: 'categoryPath', type: 'string[]', facet: true },
    { name: 'brandId', type: 'string', facet: true, optional: true },
    { name: 'brandName', type: 'string', facet: true, optional: true },
    { name: 'tags', type: 'string[]', facet: true, optional: true },
    
    // Seller info
    { name: 'sellerId', type: 'string', facet: true },
    { name: 'sellerName', type: 'string', facet: true },
    { name: 'sellerRating', type: 'float', facet: true },
    
    // Search optimization
    { name: 'searchKeywords', type: 'string[]', facet: false, optional: true },
    { name: 'searchScore', type: 'float', facet: false },
    { name: 'searchPopularity', type: 'int32', facet: false },
    
    // User personalization
    { name: 'views', type: 'int32', facet: false },
    { name: 'purchases', type: 'int32', facet: false },
    { name: 'rating', type: 'float', facet: true },
    { name: 'reviewCount', type: 'int32', facet: true },
    
    // Inventory
    { name: 'availableQuantity', type: 'int32', facet: true },
    { name: 'isInStock', type: 'bool', facet: true },
    
    // Attributes for filtering
    { name: 'attributes', type: 'object', facet: true, optional: true },
    { name: 'variants', type: 'object[]', facet: false, optional: true },
    
    // Images
    { name: 'mainImage', type: 'string', facet: false, optional: true },
    { name: 'images', type: 'string[]', facet: false, optional: true },
    
    // Dates
    { name: 'createdAt', type: 'int64', facet: false },
    { name: 'updatedAt', type: 'int64', facet: false },
    
    // Geolocation (for local search)
    { name: 'geoLocation', type: 'geopoint', facet: false, optional: true },
    
    // Boost factors
    { name: 'boostFactor', type: 'float', facet: false, optional: true }
  ],
  default_sorting_field: 'searchScore',
  
  // Token separators for better search
  token_separators: ['-', '_', '/']
};
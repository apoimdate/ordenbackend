import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const sellersSchema: CollectionCreateSchema = {
  name: 'sellers',
  enable_nested_fields: true,
  fields: [
    // Basic info
    { name: 'id', type: 'string', facet: false },
    { name: 'storeName', type: 'string', facet: false, infix: true },
    { name: 'description', type: 'string', facet: false, optional: true },
    { name: 'slug', type: 'string', facet: false },
    
    // Contact
    { name: 'email', type: 'string', facet: false },
    { name: 'phone', type: 'string', facet: false, optional: true },
    
    // Status
    { name: 'status', type: 'string', facet: true },
    { name: 'isVerified', type: 'bool', facet: true },
    { name: 'isActive', type: 'bool', facet: true },
    { name: 'isFeatured', type: 'bool', facet: true },
    
    // Performance metrics
    { name: 'rating', type: 'float', facet: true },
    { name: 'reviewCount', type: 'int32', facet: true },
    { name: 'totalSales', type: 'int32', facet: true },
    { name: 'totalProducts', type: 'int32', facet: true },
    { name: 'responseTime', type: 'float', facet: true }, // in hours
    { name: 'fulfillmentRate', type: 'float', facet: true }, // percentage
    
    // Location
    { name: 'country', type: 'string', facet: true },
    { name: 'state', type: 'string', facet: true, optional: true },
    { name: 'city', type: 'string', facet: true, optional: true },
    { name: 'geoLocation', type: 'geopoint', facet: false, optional: true },
    
    // Business info
    { name: 'categories', type: 'string[]', facet: true },
    { name: 'badges', type: 'string[]', facet: true, optional: true },
    { name: 'yearEstablished', type: 'int32', facet: true, optional: true },
    
    // Search optimization
    { name: 'searchKeywords', type: 'string[]', facet: false, optional: true },
    { name: 'searchScore', type: 'float', facet: false },
    
    // Dates
    { name: 'createdAt', type: 'int64', facet: false },
    { name: 'lastActiveAt', type: 'int64', facet: false },
    
    // Images
    { name: 'logo', type: 'string', facet: false, optional: true },
    { name: 'banner', type: 'string', facet: false, optional: true }
  ],
  default_sorting_field: 'rating'
};
#!/usr/bin/env node

const Typesense = require('typesense');

// Initialize Typesense client
const client = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: process.env.TYPESENSE_PORT || 8108,
      protocol: 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz789',
  connectionTimeoutSeconds: 10,
});

// Collection schemas
const collectionSchemas = [
  {
    name: 'products',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'sku', type: 'string' },
      { name: 'price', type: 'float' },
      { name: 'currency', type: 'string' },
      { name: 'categoryId', type: 'string' },
      { name: 'categoryName', type: 'string', optional: true },
      { name: 'brandId', type: 'string', optional: true },
      { name: 'brandName', type: 'string', optional: true },
      { name: 'sellerId', type: 'string' },
      { name: 'sellerName', type: 'string', optional: true },
      { name: 'tags', type: 'string[]', optional: true },
      { name: 'isPublished', type: 'bool' },
      { name: 'isActive', type: 'bool' },
      { name: 'stockQuantity', type: 'int32' },
      { name: 'weight', type: 'float', optional: true },
      { name: 'rating', type: 'float', optional: true },
      { name: 'reviewCount', type: 'int32', optional: true },
      { name: 'createdAt', type: 'int64' },
      { name: 'updatedAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'categories',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'slug', type: 'string' },
      { name: 'parentId', type: 'string', optional: true },
      { name: 'isActive', type: 'bool' },
      { name: 'productCount', type: 'int32', optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'sellers',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'storeName', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'email', type: 'string' },
      { name: 'businessType', type: 'string' },
      { name: 'country', type: 'string' },
      { name: 'city', type: 'string' },
      { name: 'state', type: 'string' },
      { name: 'currency', type: 'string' },
      { name: 'isActive', type: 'bool' },
      { name: 'isVerified', type: 'bool' },
      { name: 'rating', type: 'float', optional: true },
      { name: 'reviewCount', type: 'int32', optional: true },
      { name: 'productCount', type: 'int32', optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'orders',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'orderNumber', type: 'string' },
      { name: 'userId', type: 'string' },
      { name: 'sellerId', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'paymentStatus', type: 'string' },
      { name: 'shippingStatus', type: 'string' },
      { name: 'totalAmount', type: 'float' },
      { name: 'currency', type: 'string' },
      { name: 'itemCount', type: 'int32' },
      { name: 'customerEmail', type: 'string', optional: true },
      { name: 'createdAt', type: 'int64' },
      { name: 'updatedAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'users',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'username', type: 'string' },
      { name: 'firstName', type: 'string' },
      { name: 'lastName', type: 'string' },
      { name: 'fullName', type: 'string', optional: true },
      { name: 'role', type: 'string' },
      { name: 'isActive', type: 'bool' },
      { name: 'isEmailVerified', type: 'bool' },
      { name: 'preferredCurrency', type: 'string' },
      { name: 'country', type: 'string', optional: true },
      { name: 'city', type: 'string', optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
];

async function initializeTypesense() {
  console.log('🔍 Initializing Typesense collections...');
  
  try {
    // Check if Typesense is accessible
    const health = await client.health.retrieve();
    console.log('✅ Typesense server is healthy:', health);
    
    // Initialize collections
    for (const collectionSchema of collectionSchemas) {
      try {
        // Try to retrieve existing collection
        await client.collections(collectionSchema.name).retrieve();
        console.log(`📁 Collection '${collectionSchema.name}' already exists`);
      } catch (error) {
        if (error.httpStatus === 404) {
          // Collection doesn't exist, create it
          console.log(`📁 Creating collection '${collectionSchema.name}'...`);
          await client.collections().create(collectionSchema);
          console.log(`✅ Collection '${collectionSchema.name}' created successfully`);
        } else {
          console.error(`❌ Error checking collection '${collectionSchema.name}':`, error.message);
        }
      }
    }
    
    console.log('🎉 Typesense initialization completed successfully!');
    
    // List all collections
    const collections = await client.collections().retrieve();
    console.log('\n📋 Available collections:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name} (${collection.num_documents} documents)`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize Typesense:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Typesense server is not running. Please start it first:');
      console.log('   Option 1: Use Docker Compose: docker-compose up -d typesense');
      console.log('   Option 2: Download and run Typesense binary manually');
      console.log('   Option 3: Use Typesense Cloud service');
    }
    
    process.exit(1);
  }
}

// Run initialization
if (require.main === module) {
  initializeTypesense().catch(console.error);
}

module.exports = { initializeTypesense, collectionSchemas };
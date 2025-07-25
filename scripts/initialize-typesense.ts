import { TypesenseClient } from '../src/integrations/typesense/client';
import {
  productsSchema,
  sellersSchema,
  categoriesSchema,
  searchQueriesSchema
} from '../src/integrations/typesense/schemas';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function initializeTypesense() {
  const typesense = TypesenseClient.getInstance();

  try {
    // Check health
    const isHealthy = await typesense.health();
    if (!isHealthy) {
      throw new Error('Typesense is not healthy');
    }

    console.log('✅ Typesense is healthy');

    // List of collections to create
    const collections = [
      { name: 'products', schema: productsSchema },
      { name: 'sellers', schema: sellersSchema },
      { name: 'categories', schema: categoriesSchema },
      { name: 'search_queries', schema: searchQueriesSchema }
    ];

    for (const { name, schema } of collections) {
      try {
        // Try to delete existing collection first (for development)
        if (process.env.NODE_ENV === 'development') {
          await typesense.deleteCollection(name);
          console.log(`🗑️  Deleted existing collection: ${name}`);
        }
      } catch (error) {
        // Collection doesn't exist, continue
      }

      try {
        await typesense.createCollection(schema);
        console.log(`✅ Created collection: ${name}`);
      } catch (error: any) {
        if (error.httpStatus === 409) {
          console.log(`ℹ️  Collection ${name} already exists`);
        } else {
          throw error;
        }
      }
    }

    // Verify all collections
    const existingCollections = await typesense.listCollections();
    console.log('\n📊 Existing collections:');
    existingCollections.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.num_documents} documents)`);
    });

    console.log('\n✅ Typesense initialization complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Run "npm run typesense:reindex" to index existing data');
    console.log('2. Ensure Typesense is running on the configured host/port');
    console.log('3. Update search endpoints to use the SearchService');

  } catch (error) {
    console.error('❌ Failed to initialize Typesense:', error);
    process.exit(1);
  }
}

// Run initialization
initializeTypesense();
import { PrismaClient } from '@prisma/client';
import { TypesenseClient } from '../src/integrations/typesense/client';
import { SearchService } from '../src/services/search.service';
import { Redis } from 'ioredis';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

async function reindexProducts() {
  const searchService = new SearchService(redis);
  const batchSize = 100;
  let processed = 0;
  let cursor: string | undefined;

  console.log('🔄 Starting product reindexing...');

  try {
    while (true) {
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          isPublished: true
        },
        include: {
          category: true,
          seller: true,
          images: true,
          variants: true,
          tags: {
            include: {
              tag: true
            }
          },
          inventory: true,
          _count: {
            select: {
              reviews: true
            }
          }
        },
        take: batchSize,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1
        }),
        orderBy: {
          id: 'asc'
        }
      });

      if (products.length === 0) break;

      // Index batch
      await searchService.indexProducts(products);
      processed += products.length;

      console.log(`  Indexed ${processed} products...`);

      // Update cursor
      cursor = products[products.length - 1].id;

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Indexed ${processed} products`);
  } catch (error) {
    console.error('❌ Product indexing failed:', error);
    throw error;
  }
}

async function reindexSellers() {
  const typesense = TypesenseClient.getInstance();
  const batchSize = 100;
  let processed = 0;
  let cursor: string | undefined;

  console.log('🔄 Starting seller reindexing...');

  try {
    while (true) {
      const sellers = await prisma.seller.findMany({
        where: {
          isActive: true,
          status: 'ACTIVE'
        },
        include: {
          _count: {
            select: {
              products: true,
              reviews: true,
              orders: true
            }
          }
        },
        take: batchSize,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1
        }),
        orderBy: {
          id: 'asc'
        }
      });

      if (sellers.length === 0) break;

      const documents = sellers.map(seller => ({
        id: seller.id,
        storeName: seller.storeName,
        description: seller.description,
        slug: seller.slug,
        email: seller.email,
        phone: seller.phone,
        status: seller.status,
        isVerified: seller.isVerified,
        isActive: seller.isActive,
        isFeatured: seller.isFeatured,
        rating: seller.rating || 0,
        reviewCount: seller._count.reviews,
        totalSales: seller._count.orders,
        totalProducts: seller._count.products,
        responseTime: 24, // TODO: Calculate actual response time
        fulfillmentRate: 0.95, // TODO: Calculate actual rate
        country: seller.country,
        state: seller.state,
        city: seller.city,
        categories: [], // TODO: Get seller categories
        badges: [], // TODO: Get seller badges
        searchScore: 1,
        createdAt: Math.floor(seller.createdAt.getTime() / 1000),
        lastActiveAt: Math.floor((seller.lastLoginAt || seller.createdAt).getTime() / 1000),
        logo: seller.logo,
        banner: seller.banner
      }));

      await typesense.upsertDocuments('sellers', documents);
      processed += documents.length;

      console.log(`  Indexed ${processed} sellers...`);

      cursor = sellers[sellers.length - 1].id;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Indexed ${processed} sellers`);
  } catch (error) {
    console.error('❌ Seller indexing failed:', error);
    throw error;
  }
}

async function reindexCategories() {
  const typesense = TypesenseClient.getInstance();
  
  console.log('🔄 Starting category reindexing...');

  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    const documents = await Promise.all(
      categories.map(async (category) => {
        // Get category path
        const path: string[] = [];
        let currentId: string | null = category.id;
        
        while (currentId) {
          const cat = categories.find(c => c.id === currentId);
          if (!cat) break;
          path.unshift(cat.name);
          currentId = cat.parentId;
        }

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          slug: category.slug,
          parentId: category.parentId,
          path,
          level: path.length - 1,
          productCount: category._count.products,
          isActive: category.isActive,
          isFeatured: category.isFeatured,
          order: category.order,
          image: category.image,
          icon: category.icon
        };
      })
    );

    await typesense.upsertDocuments('categories', documents);
    console.log(`✅ Indexed ${documents.length} categories`);
  } catch (error) {
    console.error('❌ Category indexing failed:', error);
    throw error;
  }
}

async function main() {
  try {
    // Verify Typesense is healthy
    const typesense = TypesenseClient.getInstance();
    const isHealthy = await typesense.health();
    
    if (!isHealthy) {
      throw new Error('Typesense is not healthy. Please ensure it is running.');
    }

    console.log('✅ Typesense is healthy\n');

    // Reindex all collections
    await reindexProducts();
    console.log('');
    
    await reindexSellers();
    console.log('');
    
    await reindexCategories();
    console.log('');

    console.log('✅ Reindexing complete!');

    // Show collection stats
    const collections = await typesense.listCollections();
    console.log('\n📊 Collection statistics:');
    collections.forEach((col: any) => {
      console.log(`  - ${col.name}: ${col.num_documents} documents`);
    });

  } catch (error) {
    console.error('❌ Reindexing failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

// Run reindexing
main();
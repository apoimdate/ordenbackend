import fs from 'fs/promises';
import path from 'path';
import { getDMMF } from '@prisma/internals';

const PRISMA_SCHEMA_PATH = path.join(process.cwd(), 'prisma/schema.prisma');
const REPOSITORIES_PATH = path.join(process.cwd(), 'src/repositories');
const REPOSITORIES_INDEX_PATH = path.join(REPOSITORIES_PATH, 'index.ts');

// Models to skip (audit models and special cases)
const SKIP_MODELS = [
  'AdminActionLog',
  'SellerActionLog', 
  'UserActionLog',
  'OrderAuditLog',
  'PaymentAuditLog',
  'SecurityAuditLog',
  'SystemEvent',
  'APIRequestLog',
  'ScheduledJobLog',
  'DataChangeLog',
  'PerformanceMetric',
  'ErrorLog'
];

interface ModelInfo {
  name: string;
  plural: string;
  fields: any[];
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function pluralize(str: string): string {
  if (str.endsWith('y') && !str.endsWith('ay') && !str.endsWith('ey') && !str.endsWith('oy')) {
    return str.slice(0, -1) + 'ies';
  }
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('z') || 
      str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es';
  }
  return str + 's';
}

async function generateRepository(model: ModelInfo): Promise<void> {
  const modelName = toPascalCase(model.name);
  const repositoryName = `${modelName}Repository`;
  const fileName = `${toKebabCase(model.name)}.repository.ts`;
  const filePath = path.join(REPOSITORIES_PATH, fileName);

  // Generate special methods based on model fields
  const specialMethods: string[] = [];

  // Check for common field patterns
  const hasEmail = model.fields.some(f => f.name === 'email');
  const hasSlug = model.fields.some(f => f.name === 'slug');
  const hasStatus = model.fields.some(f => f.name === 'status');
  const hasUserId = model.fields.some(f => f.name === 'userId');
  const hasSellerId = model.fields.some(f => f.name === 'sellerId');
  const hasIsActive = model.fields.some(f => f.name === 'isActive');
  const hasIsDeleted = model.fields.some(f => f.name === 'isDeleted');
  const hasCode = model.fields.some(f => f.name === 'code');
  const hasName = model.fields.some(f => f.name === 'name');
  const hasType = model.fields.some(f => f.name === 'type');
  const hasCreatedAt = model.fields.some(f => f.name === 'createdAt');

  if (hasEmail) {
    specialMethods.push(`
  async findByEmail(email: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName} | null> {
    return this.findUnique({ email: email.toLowerCase() }, options);
  }`);
  }

  if (hasSlug) {
    specialMethods.push(`
  async findBySlug(slug: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName} | null> {
    return this.findUnique({ slug }, options);
  }`);
  }

  if (hasStatus) {
    specialMethods.push(`
  async findByStatus(status: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        status
      }
    });
  }`);
  }

  if (hasUserId) {
    specialMethods.push(`
  async findByUserId(userId: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        userId
      }
    });
  }`);
  }

  if (hasSellerId) {
    specialMethods.push(`
  async findBySellerId(sellerId: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        sellerId
      }
    });
  }`);
  }

  if (hasIsActive) {
    specialMethods.push(`
  async findActive(options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        isActive: true
      }
    });
  }`);
  }

  if (hasIsDeleted) {
    specialMethods.push(`
  async findNonDeleted(options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        isDeleted: false
      }
    });
  }

  async softDelete(id: string): Promise<${modelName}> {
    return this.update(id, { isDeleted: true, deletedAt: new Date() } as any);
  }`);
  }

  if (hasCode) {
    specialMethods.push(`
  async findByCode(code: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName} | null> {
    return this.findUnique({ code }, options);
  }

  async generateUniqueCode(prefix: string = ''): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return \`\${prefix}\${timestamp}\${random}\`.toUpperCase();
  }`);
  }

  if (hasName) {
    specialMethods.push(`
  async searchByName(name: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        name: {
          contains: name,
          mode: 'insensitive'
        }
      }
    });
  }`);
  }

  if (hasType) {
    specialMethods.push(`
  async findByType(type: string, options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        type
      }
    });
  }`);
  }

  if (hasCreatedAt) {
    specialMethods.push(`
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: Omit<FindOptions, 'where'>
  ): Promise<${modelName}[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  }

  async findRecent(days: number = 7, options?: Omit<FindOptions, 'where'>): Promise<${modelName}[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }`);
  }

  // Model-specific methods
  const modelSpecificMethods: Record<string, string> = {
    User: `
  async findByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
    return this.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername.toLowerCase() }
        ]
      }
    });
  }

  async updateLastLogin(userId: string): Promise<User> {
    return this.update(userId, { lastLoginAt: new Date() } as any);
  }`,
    
    Product: `
  async findPublished(options?: Omit<FindOptions, 'where'>): Promise<Product[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        isPublished: true,
        isActive: true
      }
    });
  }

  async updateSearchScore(productId: string, score: number): Promise<Product> {
    return this.update(productId, { searchScore: score } as any);
  }

  async incrementView(productId: string): Promise<Product> {
    const product = await this.findById(productId);
    if (!product) throw new Error('Product not found');
    
    return this.update(productId, {
      views: (product.views || 0) + 1,
      searchPopularity: (product.searchPopularity || 0) + 1
    } as any);
  }`,

    Order: `
  async findByStatus(status: string, options?: Omit<FindOptions, 'where'>): Promise<Order[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        status
      }
    });
  }

  async updateStatus(orderId: string, status: string): Promise<Order> {
    return this.update(orderId, { status, updatedAt: new Date() } as any);
  }

  async calculateTotalsByUser(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
  }> {
    const result = await this.aggregate({
      where: { userId },
      _count: true,
      _sum: {
        totalAmount: true
      }
    });

    return {
      totalOrders: result._count || 0,
      totalSpent: result._sum?.totalAmount || 0
    };
  }`,

    Payment: `
  async findPending(options?: Omit<FindOptions, 'where'>): Promise<Payment[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        status: 'PENDING'
      }
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: string,
    transactionId?: string
  ): Promise<Payment> {
    const updateData: any = { status };
    if (transactionId) {
      updateData.transactionId = transactionId;
    }
    if (status === 'COMPLETED') {
      updateData.paidAt = new Date();
    }
    
    return this.update(paymentId, updateData);
  }`,

    Category: `
  async findRootCategories(options?: Omit<FindOptions, 'where'>): Promise<Category[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        parentId: null
      }
    });
  }

  async findWithChildren(categoryId: string): Promise<Category | null> {
    return this.findById(categoryId, {
      include: {
        children: true
      }
    });
  }

  async getFullPath(categoryId: string): Promise<Category[]> {
    const path: Category[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.findById(currentId);
      if (!category) break;
      
      path.unshift(category);
      currentId = category.parentId;
    }

    return path;
  }`,

    Inventory: `
  async findLowStock(threshold: number = 10, options?: Omit<FindOptions, 'where'>): Promise<Inventory[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        availableQuantity: {
          lte: threshold
        }
      }
    });
  }

  async updateStock(
    inventoryId: string,
    quantity: number,
    operation: 'increment' | 'decrement' | 'set'
  ): Promise<Inventory> {
    const inventory = await this.findById(inventoryId);
    if (!inventory) throw new Error('Inventory not found');

    let newQuantity: number;
    switch (operation) {
      case 'increment':
        newQuantity = inventory.availableQuantity + quantity;
        break;
      case 'decrement':
        newQuantity = Math.max(0, inventory.availableQuantity - quantity);
        break;
      case 'set':
        newQuantity = quantity;
        break;
    }

    return this.update(inventoryId, {
      availableQuantity: newQuantity,
      lastRestockDate: operation === 'increment' ? new Date() : inventory.lastRestockDate
    } as any);
  }`,

    Review: `
  async findByProductId(
    productId: string,
    options?: Omit<FindOptions, 'where'>
  ): Promise<Review[]> {
    return this.findMany({
      ...options,
      where: {
        ...options?.where,
        productId
      },
      orderBy: options?.orderBy || { createdAt: 'desc' }
    });
  }

  async calculateAverageRating(productId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    const result = await this.aggregate({
      where: { productId },
      _avg: {
        rating: true
      },
      _count: true
    });

    return {
      averageRating: result._avg?.rating || 0,
      totalReviews: result._count || 0
    };
  }`,

    Cart: `
  async findActiveByUserId(userId: string): Promise<Cart | null> {
    return this.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
  }

  async clearCart(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { cartId }
    });
    
    await this.update(cartId, {
      totalAmount: 0,
      totalItems: 0
    } as any);
  }`
  };

  const modelMethod = modelSpecificMethods[modelName] || '';

  const content = `import { ${modelName}, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';
import { FindOptions } from './base.repository';

export class ${repositoryName} extends BaseRepository<
  ${modelName},
  Prisma.${modelName}CreateInput,
  Prisma.${modelName}UpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, '${toCamelCase(modelName)}');
  }
${specialMethods.join('\n')}${modelMethod}
}
`;

  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`✅ Generated ${fileName}`);
}

async function generateRepositoriesIndex(models: ModelInfo[]): Promise<void> {
  const imports: string[] = [];
  const exports: string[] = [];

  for (const model of models) {
    const modelName = toPascalCase(model.name);
    const fileName = toKebabCase(model.name);
    imports.push(`import { ${modelName}Repository } from './${fileName}.repository';`);
    exports.push(`export { ${modelName}Repository };`);
  }

  const content = `// Auto-generated repository exports
${imports.join('\n')}

// Export base repository
export { BaseRepository } from './base.repository';
export type { FindOptions, BatchOptions } from './base.repository';

// Export all repositories
${exports.join('\n')}

// Repository types
export type RepositoryTypes = {
${models.map(m => `  ${toCamelCase(m.name)}: ${toPascalCase(m.name)}Repository;`).join('\n')}
};
`;

  await fs.writeFile(REPOSITORIES_INDEX_PATH, content, 'utf-8');
  console.log('✅ Generated repositories index');
}

async function main() {
  try {
    // Ensure repositories directory exists
    await fs.mkdir(REPOSITORIES_PATH, { recursive: true });

    // Read and parse Prisma schema
    const schemaContent = await fs.readFile(PRISMA_SCHEMA_PATH, 'utf-8');
    const dmmf = await getDMMF({ datamodel: schemaContent });

    // Get all models
    const models: ModelInfo[] = dmmf.datamodel.models
      .filter(model => !SKIP_MODELS.includes(model.name))
      .map(model => ({
        name: model.name,
        plural: pluralize(model.name),
        fields: model.fields
      }));

    console.log(`🚀 Generating repositories for ${models.length} models...`);

    // Generate repository for each model
    for (const model of models) {
      await generateRepository(model);
    }

    // Generate index file
    await generateRepositoriesIndex(models);

    console.log(`\n✅ Successfully generated ${models.length} repositories!`);
    console.log('📁 Location: src/repositories/');
    console.log('\n📝 Next steps:');
    console.log('1. Run "npm run db:generate" to generate Prisma client');
    console.log('2. Run "npm run db:migrate" to create database tables');
    console.log('3. Import and use repositories in your services');

  } catch (error) {
    console.error('❌ Error generating repositories:', error);
    process.exit(1);
  }
}

main();
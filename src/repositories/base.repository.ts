import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export interface FindOptions {
  where?: any;
  include?: any;
  select?: any;
  orderBy?: any;
  skip?: number;
  take?: number;
  cursor?: any;
}

// Helper types for repositories
export type FindOptionsWithoutWhere = Omit<FindOptions, 'where'>;
export type MergeWhereOptions = FindOptionsWithoutWhere & { where?: any };

export interface BatchOptions {
  batchSize?: number;
  onBatch?: (items: any[]) => Promise<void>;
}

export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected prisma: PrismaClient;
  protected redis: Redis;
  protected logger: Logger;
  protected modelName: string;
  protected cachePrefix: string;
  protected cacheTTL: number;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    logger: Logger,
    modelName: string,
    cacheTTL: number = 300 // 5 minutes default
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
    this.modelName = modelName;
    this.cachePrefix = `repo:${modelName.toLowerCase()}`;
    this.cacheTTL = cacheTTL;
  }

  // Create
  async create(data: CreateInput): Promise<T> {
    try {
      const result = await (this.prisma as any)[this.modelName].create({
        data
      });
      await this.invalidateCache();
      this.logger.info({ modelName: this.modelName, id: result.id }, 'Created record');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Create failed');
      throw error;
    }
  }

  // Create many
  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    try {
      const result = await (this.prisma as any)[this.modelName].createMany({
        data,
        skipDuplicates: true
      });
      await this.invalidateCache();
      this.logger.info({ modelName: this.modelName, count: result.count }, 'Created many records');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Create many failed');
      throw error;
    }
  }

  // Find by ID
  async findById(id: string, options?: Omit<FindOptions, 'where'>): Promise<T | null> {
    const cacheKey = `${this.cachePrefix}:${id}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await (this.prisma as any)[this.modelName].findUnique({
        where: { id },
        ...options
      });

      if (result) {
        await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));
      }

      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName, id }, 'Find by ID failed');
      throw error;
    }
  }

  // Find unique
  async findUnique(where: any, options?: Omit<FindOptions, 'where'>): Promise<T | null> {
    try {
      return await (this.prisma as any)[this.modelName].findUnique({
        where,
        ...options
      });
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName, where }, 'Find unique failed');
      throw error;
    }
  }

  // Find first
  async findFirst(options?: FindOptions): Promise<T | null> {
    try {
      return await (this.prisma as any)[this.modelName].findFirst(options);
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Find first failed');
      throw error;
    }
  }

  // Find many
  async findMany(options?: FindOptions): Promise<T[]> {
    try {
      return await (this.prisma as any)[this.modelName].findMany(options);
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Find many failed');
      throw error;
    }
  }

  // Find with pagination
  async findWithPagination(
    page: number = 1,
    limit: number = 20,
    options?: FindOptions
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const [data, total] = await Promise.all([
        (this.prisma as any)[this.modelName].findMany({
          ...options,
          skip,
          take: limit
        }),
        (this.prisma as any)[this.modelName].count({
          where: options?.where
        })
      ]);

      return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Find with pagination failed');
      throw error;
    }
  }

  // Update
  async update(id: string, data: UpdateInput): Promise<T> {
    try {
      const result = await (this.prisma as any)[this.modelName].update({
        where: { id },
        data
      });
      await this.invalidateCache(id);
      this.logger.info({ modelName: this.modelName, id }, 'Updated record');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName, id }, 'Update failed');
      throw error;
    }
  }

  // Update many
  async updateMany(where: any, data: UpdateInput): Promise<{ count: number }> {
    try {
      const result = await (this.prisma as any)[this.modelName].updateMany({
        where,
        data
      });
      await this.invalidateCache();
      this.logger.info({ modelName: this.modelName, count: result.count }, 'Updated many records');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Update many failed');
      throw error;
    }
  }

  // Upsert
  async upsert(
    where: any,
    create: CreateInput,
    update: UpdateInput
  ): Promise<T> {
    try {
      const result = await (this.prisma as any)[this.modelName].upsert({
        where,
        create,
        update
      });
      await this.invalidateCache();
      this.logger.info({ modelName: this.modelName }, 'Upserted record');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Upsert failed');
      throw error;
    }
  }

  // Delete
  async delete(id: string): Promise<T> {
    try {
      const result = await (this.prisma as any)[this.modelName].delete({
        where: { id }
      });
      await this.invalidateCache(id);
      this.logger.info({ modelName: this.modelName, id }, 'Deleted record');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName, id }, 'Delete failed');
      throw error;
    }
  }

  // Delete many
  async deleteMany(where: any): Promise<{ count: number }> {
    try {
      const result = await (this.prisma as any)[this.modelName].deleteMany({
        where
      });
      await this.invalidateCache();
      this.logger.info({ modelName: this.modelName, count: result.count }, 'Deleted many records');
      return result;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Delete many failed');
      throw error;
    }
  }

  // Count
  async count(where?: any): Promise<number> {
    try {
      return await (this.prisma as any)[this.modelName].count({ where });
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Count failed');
      throw error;
    }
  }

  // Exists
  async exists(where: any): Promise<boolean> {
    try {
      const count = await this.count(where);
      return count > 0;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Exists check failed');
      throw error;
    }
  }

  // Aggregate
  async aggregate(options: any): Promise<any> {
    try {
      return await (this.prisma as any)[this.modelName].aggregate(options);
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Aggregate failed');
      throw error;
    }
  }

  // Group by
  async groupBy(options: any): Promise<any[]> {
    try {
      return await (this.prisma as any)[this.modelName].groupBy(options);
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Group by failed');
      throw error;
    }
  }

  // Find many with cursor pagination
  async findManyWithCursor(
    cursor?: string,
    limit: number = 20,
    options?: Omit<FindOptions, 'cursor' | 'take'>
  ): Promise<{
    data: T[];
    nextCursor: string | null;
  }> {
    try {
      const results = await (this.prisma as any)[this.modelName].findMany({
        ...options,
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1
        })
      });

      let nextCursor = null;
      if (results.length > limit) {
        const nextItem = results.pop();
        nextCursor = nextItem.id;
      }

      return {
        data: results,
        nextCursor
      };
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Find many with cursor failed');
      throw error;
    }
  }

  // Batch process
  async batchProcess(
    where: any,
    batchOptions: BatchOptions
  ): Promise<number> {
    const { batchSize = 100, onBatch } = batchOptions;
    let processed = 0;
    let cursor: string | undefined;

    try {
      while (true) {
        const { data, nextCursor } = await this.findManyWithCursor(
          cursor,
          batchSize,
          { where }
        );

        if (data.length === 0) break;

        if (onBatch) {
          await onBatch(data);
        }

        processed += data.length;
        cursor = nextCursor || undefined;

        if (!nextCursor) break;
      }

      return processed;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Batch process failed');
      throw error;
    }
  }

  // Transaction wrapper
  async transaction<R>(
    fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<R>
  ): Promise<R> {
    try {
      return await this.prisma.$transaction(fn) as R;
    } catch (error) {
      this.logger.error({ error, modelName: this.modelName }, 'Transaction failed');
      throw error;
    }
  }

  // Cache invalidation
  protected async invalidateCache(id?: string): Promise<void> {
    try {
      if (id) {
        await this.redis.del(`${this.cachePrefix}:${id}`);
      } else {
        // Invalidate all cache for this model
        const keys = await this.redis.keys(`${this.cachePrefix}:*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      this.logger.warn({ error, modelName: this.modelName }, 'Cache invalidation failed');
    }
  }

  // Raw query - SECURITY: Use parameterized queries only
  async raw<R = any>(query: string, params: any[] = []): Promise<R> {
    try {
      // SECURITY FIX: Use proper parameterized query instead of template literal
      if (params.length === 0) {
        // For queries without parameters, use $queryRaw with Prisma.sql
        return await this.prisma.$queryRaw(Prisma.sql([query] as any));
      } else {
        // For parameterized queries, use Prisma.sql template function
        return await this.prisma.$queryRaw(Prisma.sql([query, ...params] as any));
      }
    } catch (error) {
      this.logger.error({ 
        error, 
        modelName: this.modelName, 
        query: query.substring(0, 100) + '...', // Log only first 100 chars for security
        paramCount: params.length 
      }, 'Raw query failed');
      throw error;
    }
  }
}

import { Redis } from 'ioredis';
import { logger } from './logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  json?: boolean;
}

class CacheService {
  private redis?: Redis;
  private defaultTTL: number = 3600; // 1 hour

  /**
   * Initialize cache with Redis client
   */
  initialize(redis: Redis): void {
    this.redis = redis;
    logger.info('Cache service initialized');
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping get');
      return null;
    }

    try {
      const fullKey = this.getFullKey(key, options.prefix);
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }

      if (options.json !== false) {
        return JSON.parse(value);
      }

      return value as T;
    } catch (error) { logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping set');
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      const serialized = options.json !== false ? JSON.stringify(value) : value;

      await this.redis.setex(fullKey, ttl, serialized);
      return true;
    } catch (error) { logger.error({ error, key }, 'Cache set error');
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string, prefix?: string): Promise<boolean> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping del');
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, prefix);
      await this.redis.del(fullKey);
      return true;
    } catch (error) { logger.error({ error, key }, 'Cache del error');
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string, prefix?: string): Promise<number> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping delPattern');
      return 0;
    }

    try {
      const fullPattern = this.getFullKey(pattern, prefix);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) { logger.error({ error, pattern }, 'Cache delPattern error');
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping exists');
      return false;
    }

    try {
      const fullKey = this.getFullKey(key, prefix);
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) { logger.error({ error, key }, 'Cache exists error');
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string, prefix?: string): Promise<number> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping ttl');
      return -1;
    }

    try {
      const fullKey = this.getFullKey(key, prefix);
      return await this.redis.ttl(fullKey);
    } catch (error) { logger.error({ error, key }, 'Cache ttl error');
      return -1;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string, prefix?: string): Promise<number> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping incr');
      return 0;
    }

    try {
      const fullKey = this.getFullKey(key, prefix);
      return await this.redis.incr(fullKey);
    } catch (error) { logger.error({ error, key }, 'Cache incr error');
      return 0;
    }
  }

  /**
   * Decrement a counter
   */
  async decr(key: string, prefix?: string): Promise<number> {
    if (!this.redis) {
      logger.warn('Cache not initialized, skipping decr');
      return 0;
    }

    try {
      const fullKey = this.getFullKey(key, prefix);
      return await this.redis.decr(fullKey);
    } catch (error) { logger.error({ error, key }, 'Cache decr error');
      return 0;
    }
  }

  /**
   * Execute a function with caching
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    // Execute function and cache result
    logger.debug({ key }, 'Cache miss');
    const result = await fn();
    
    // Cache the result
    await this.set(key, result, options);
    
    return result;
  }

  /**
   * Clear all cache entries with a specific prefix
   */
  async clearPrefix(prefix: string): Promise<number> {
    return this.delPattern('*', prefix);
  }

  /**
   * Alias for delPattern to maintain backward compatibility
   */
  async invalidatePattern(pattern: string, prefix?: string): Promise<number> {
    return this.delPattern(pattern, prefix);
  }

  /**
   * Get full cache key with prefix
   */
  private getFullKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }
}

// Export singleton instance
export const cache = new CacheService();

// Helper functions for common cache operations
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  product: (id: string) => `product:${id}`,
  productList: (page: number, limit: number) => `products:${page}:${limit}`,
  category: (id: string) => `category:${id}`,
  categoryTree: () => 'categories:tree',
  seller: (id: string) => `seller:${id}`,
  sellerProducts: (sellerId: string) => `seller:${sellerId}:products`,
  order: (id: string) => `order:${id}`,
  userOrders: (userId: string) => `user:${userId}:orders`,
  cart: (userId: string) => `cart:${userId}`,
  wishlist: (userId: string) => `wishlist:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  otp: (email: string) => `otp:${email}`,
  passwordReset: (token: string) => `password-reset:${token}`,
  twoFactorSecret: (userId: string) => `2fa:${userId}`,
  rateLimit: (key: string) => `rate-limit:${key}`,
  search: (query: string) => `search:${query}`,
  analytics: (key: string) => `analytics:${key}`,
};

// Cache TTL constants
export const cacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
  SESSION: 604800, // 7 days
};
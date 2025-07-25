import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Create Redis client with configuration
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn({ attempt: times, delay }, 'Retrying Redis connection');
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  disconnectTimeout: 2000,
  commandTimeout: 5000,
  lazyConnect: false
});

// Queue Redis client (separate connection)
export const queueRedis = new Redis({
  host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379'),
  password: process.env.QUEUE_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
  db: 1, // Use different database for queues
  maxRetriesPerRequest: null // BullMQ requirement
});

// Event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error: any) => {
  logger.error({ error: error }, 'Redis client error');
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', (delay: number) => {
  logger.info({ delay }, 'Redis client reconnecting');
});

// Queue Redis event handlers
queueRedis.on('connect', () => {
  logger.info('Queue Redis client connected');
});

queueRedis.on('error', (_error) => {
  logger.error({ error: _error }, 'Queue Redis client error');
});

// Helper functions

/**
 * Cache wrapper with automatic JSON serialization
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (_error) { logger.error({ error: _error, key }, 'Cache get error');
    return null;
  }
}

/**
 * Cache set with automatic JSON serialization
 */
export async function cacheSet(
  key: string,
  value: any,
  ttl?: number
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (_error) { logger.error({ error: _error, key }, 'Cache set error');
  }
}

/**
 * Cache delete
 */
export async function cacheDel(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      return await redis.del(...keys);
    }
    return 0;
  } catch (_error) { logger.error({ error: _error, pattern }, 'Cache delete error');
    return 0;
  }
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(patterns: string[]): Promise<void> {
  try {
    for (const pattern of patterns) {
      await cacheDel(pattern);
    }
  } catch (_error) { logger.error({ error: _error, patterns }, 'Cache invalidation error');
  }
}

/**
 * Get or set cache
 */
export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Generate value
  const value = await factory();
  
  // Store in cache
  await cacheSet(key, value, ttl);
  
  return value;
}

/**
 * Distributed lock implementation
 */
export async function acquireLock(
  key: string,
  ttl: number = 5000
): Promise<boolean> {
  const lockKey = `lock:${key}`;
  const identifier = Date.now().toString();
  
  const result = await redis.set(lockKey, identifier, 'PX', ttl, 'NX');
  return result === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  const lockKey = `lock:${key}`;
  await redis.del(lockKey);
}

/**
 * Rate limiting helper
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - window * 1000;
  
  // Remove old entries
  await redis.zremrangebyscore(key, '-inf', windowStart);
  
  // Count current entries
  const count = await redis.zcard(key);
  
  if (count < limit) {
    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, window);
    
    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: now + window * 1000
    };
  }
  
  // Get oldest entry to determine reset time
  const oldestEntries = await redis.zrange(key, 0, 0, 'WITHSCORES');
  const resetAt = oldestEntries.length > 1 
    ? parseInt(oldestEntries[1]) + window * 1000 
    : now + window * 1000;
  
  return {
    allowed: false,
    remaining: 0,
    resetAt
  };
}

// Graceful shutdown
export async function closeRedisConnections(): Promise<void> {
  try {
    await redis.quit();
    await queueRedis.quit();
    logger.info('Redis connections closed');
  } catch (_error) { logger.error({ error: _error }, 'Error closing Redis connections');
    // Force disconnect if quit fails
    redis.disconnect();
    queueRedis.disconnect();
  }
}

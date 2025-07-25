import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger as appLogger } from '../utils/logger';

export abstract class BaseService {
  protected app: FastifyInstance;
  protected prisma: PrismaClient;
  protected logger: typeof appLogger;

  constructor(app: FastifyInstance) {
    this.app = app;
    this.prisma = app.prisma;
    this.logger = appLogger;
  }

  /**
   * Initialize the service (override in child classes if needed)
   */
  async initialize(): Promise<void> {
    // Override in child classes if initialization is needed
  }

  /**
   * Cleanup resources (override in child classes if needed)
   */
  async cleanup(): Promise<void> {
    // Override in child classes if cleanup is needed
  }

  /**
   * Log service-specific info
   */
  protected log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    const serviceName = this.constructor.name;
    this.logger[level]({ service: serviceName, ...data }, message);
  }

  /**
   * Get cache key with service prefix
   */
  protected getCacheKey(key: string): string {
    const serviceName = this.constructor.name.toLowerCase().replace('service', '');
    return `${serviceName}:${key}`;
  }

  /**
   * Handle service errors consistently
   */
  protected handleError(error: any, operation: string): void {
    this.log('error', `Error in ${operation}`, { error });
    throw error;
  }
}
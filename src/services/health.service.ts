import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { TypesenseClient } from '../integrations/typesense/client';
import { logger } from '../utils/logger';
import os from 'os';
import fs from 'fs/promises';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    auditDatabase: ServiceHealth;
    redis: ServiceHealth;
    typesense: ServiceHealth;
  };
  system: SystemHealth;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

export interface SystemHealth {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    auditDatabase: boolean;
    redis: boolean;
    typesense: boolean;
    migrations: boolean;
  };
  errors?: string[];
}

export class HealthService {
  constructor(
    private prisma: PrismaClient,
    private auditPrisma: PrismaClient, // Separate connection for audit DB
    private redis: Redis,
    private typesense: TypesenseClient
  ) {}

  /**
   * Comprehensive health check
   */
  async getHealth(): Promise<HealthStatus> {
    // const startTime = process.hrtime(); // For potential performance monitoring

    const [database, auditDatabase, redis, typesense, system] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkAuditDatabase(),
      this.checkRedis(),
      this.checkTypesense(),
      this.getSystemHealth()
    ]);

    const services = {
      database: database.status === 'fulfilled' ? database.value : { status: 'unhealthy' as const, error: 'Check failed' },
      auditDatabase: auditDatabase.status === 'fulfilled' ? auditDatabase.value : { status: 'unhealthy' as const, error: 'Check failed' },
      redis: redis.status === 'fulfilled' ? redis.value : { status: 'unhealthy' as const, error: 'Check failed' },
      typesense: typesense.status === 'fulfilled' ? typesense.value : { status: 'unhealthy' as const, error: 'Check failed' }
    };

    const systemHealth = system.status === 'fulfilled' ? system.value : this.getDefaultSystemHealth();

    // Determine overall status
    const unhealthyServices = Object.values(services).filter(s => s.status === 'unhealthy').length;
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (unhealthyServices === 0) {
      status = 'healthy';
    } else if (unhealthyServices >= 2 || services.database.status === 'unhealthy') {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      system: systemHealth
    };
  }

  /**
   * Readiness check for Kubernetes/load balancers
   */
  async getReadiness(): Promise<ReadinessStatus> {
    const errors: string[] = [];
    
    const checks = {
      database: await this.isDatabaseReady(),
      auditDatabase: await this.isAuditDatabaseReady(),
      redis: await this.isRedisReady(),
      typesense: await this.isTypesenseReady(),
      migrations: await this.areMigrationsComplete()
    };

    for (const [service, ready] of Object.entries(checks)) {
      if (!ready) {
        errors.push(`${service} is not ready`);
      }
    }

    const ready = errors.length === 0;

    return {
      ready,
      timestamp: new Date().toISOString(),
      checks,
      ...(errors.length > 0 && { errors })
    };
  }

  /**
   * Liveness check - simple ping
   */
  async getLiveness(): Promise<{ alive: boolean; timestamp: string }> {
    return {
      alive: true,
      timestamp: new Date().toISOString()
    };
  }

  // Private health check methods

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error: any) {
      logger.error({ error }, 'Database health check failed');
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error.message
      };
    }
  }

  private async checkAuditDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.auditPrisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error: any) {
      logger.error({ error }, 'Audit database health check failed');
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error.message
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error: any) {
      logger.error({ error }, 'Redis health check failed');
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error.message
      };
    }
  }

  private async checkTypesense(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const healthy = await this.typesense.health();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - start
      };
    } catch (error: any) {
      logger.error({ error }, 'Typesense health check failed');
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error.message
      };
    }
  }

  private async getSystemHealth(): Promise<SystemHealth> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - Math.floor(totalIdle / totalTick * 100);

    // Get disk usage (simplified - checking root partition)
    let diskUsage = { used: 0, total: 0, percentage: 0 };
    try {
      const stats = await fs.statfs('/');
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      diskUsage = {
        used,
        total,
        percentage: Math.round((used / total) * 100)
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to get disk usage');
    }

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100)
      },
      disk: diskUsage
    };
  }

  private getDefaultSystemHealth(): SystemHealth {
    return {
      cpu: { usage: 0, cores: os.cpus().length },
      memory: { used: 0, total: 0, percentage: 0 },
      disk: { used: 0, total: 0, percentage: 0 }
    };
  }

  // Readiness check helpers

  private async isDatabaseReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async isAuditDatabaseReady(): Promise<boolean> {
    try {
      await this.auditPrisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async isRedisReady(): Promise<boolean> {
    try {
      const response = await this.redis.ping();
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  private async isTypesenseReady(): Promise<boolean> {
    try {
      return await this.typesense.health();
    } catch {
      return false;
    }
  }

  private async areMigrationsComplete(): Promise<boolean> {
    try {
      // Check if essential tables exist
      const tables = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('User', 'Product', 'Order', 'Seller')
      `;

      return tables.length === 4;
    } catch {
      return false;
    }
  }
}
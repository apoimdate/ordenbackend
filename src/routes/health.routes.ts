import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HealthService } from '../services/health.service';
import { logger } from '../utils/logger';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: {
    healthService: HealthService;
  }
) {
  const { healthService } = options;

  /**
   * Liveness probe - simple check to see if service is alive
   * Used by Kubernetes to determine if pod should be restarted
   */
  fastify.get('/live', {
    schema: {
      description: 'Liveness probe endpoint - simple check to see if service is alive', summary: 'Service liveness check', tags: ['Health'], response: {
        200: {
          type: 'object', properties: {
            alive: { type: 'boolean' }, timestamp: { type: 'string' }
          }
        }, 503: {
          type: 'object', properties: {
            alive: { type: 'boolean' }, timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const liveness = await healthService.getLiveness();
      return reply.code(200).send(liveness);
    } catch (error: any) { logger.error({ error }, 'Liveness check failed');
      return reply.code(503).send({
        alive: false,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Readiness probe - check if service is ready to accept traffic
   * Used by Kubernetes/Load Balancers to determine routing
   */
  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe endpoint - check if service is ready to accept traffic', summary: 'Service readiness check', tags: ['Health'], response: {
        200: {
          type: 'object', properties: {
            ready: { type: 'boolean' }, timestamp: { type: 'string' }, checks: {
              type: 'object', properties: {
                database: { type: 'boolean' }, auditDatabase: { type: 'boolean' }, redis: { type: 'boolean' }, typesense: { type: 'boolean' }, migrations: { type: 'boolean' }
              }
            }
          }
        }, 503: {
          type: 'object', properties: {
            ready: { type: 'boolean' }, timestamp: { type: 'string' }, checks: {
              type: 'object', properties: {
                database: { type: 'boolean' }, auditDatabase: { type: 'boolean' }, redis: { type: 'boolean' }, typesense: { type: 'boolean' }, migrations: { type: 'boolean' }
              }
            }, errors: {
              type: 'array', items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const readiness = await healthService.getReadiness();
      
      if (readiness.ready) {
        return reply.code(200).send(readiness);
      } else {
        return reply.code(503).send(readiness);
      }
    } catch (error: any) { logger.error({ error }, 'Readiness check failed');
      return reply.code(503).send({
        ready: false,
        timestamp: new Date().toISOString(),
        checks: {
          database: false,
          auditDatabase: false,
          redis: false,
          typesense: false,
          migrations: false
        },
        errors: ['Internal error during readiness check']
      });
    }
  });

  /**
   * Comprehensive health check - detailed status of all services
   * Used for monitoring dashboards and debugging
   */
  fastify.get('/health', {
    schema: {
      description: 'Comprehensive health check endpoint - detailed status of all services', summary: 'Comprehensive health check', tags: ['Health'], response: {
        200: {
          type: 'object', properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] }, timestamp: { type: 'string' }, uptime: { type: 'number' }, version: { type: 'string' }, environment: { type: 'string' }, services: {
              type: 'object', properties: {
                database: {
                  type: 'object', properties: {
                    status: { type: 'string', enum: ['healthy', 'unhealthy'] }, responseTime: { type: 'number' }, error: { type: 'string' }
                  }
                }, auditDatabase: {
                  type: 'object', properties: {
                    status: { type: 'string', enum: ['healthy', 'unhealthy'] }, responseTime: { type: 'number' }, error: { type: 'string' }
                  }
                }, redis: {
                  type: 'object', properties: {
                    status: { type: 'string', enum: ['healthy', 'unhealthy'] }, responseTime: { type: 'number' }, error: { type: 'string' }
                  }
                }, typesense: {
                  type: 'object', properties: {
                    status: { type: 'string', enum: ['healthy', 'unhealthy'] }, responseTime: { type: 'number' }, error: { type: 'string' }
                  }
                }
              }
            }, system: {
              type: 'object', properties: {
                cpu: {
                  type: 'object', properties: {
                    usage: { type: 'number' }, cores: { type: 'number' }
                  }
                }, memory: {
                  type: 'object', properties: {
                    used: { type: 'number' }, total: { type: 'number' }, percentage: { type: 'number' }
                  }
                }, disk: {
                  type: 'object', properties: {
                    used: { type: 'number' }, total: { type: 'number' }, percentage: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await healthService.getHealth();
      
      // Set appropriate status code based on health
      let statusCode = 200;
      if (health.status === 'unhealthy') {
        statusCode = 503;
      } else if (health.status === 'degraded') {
        statusCode = 200; // Still return 200 for degraded to keep service in rotation
      }
      
      return reply.code(statusCode).send(health);
    } catch (error: any) { logger.error({ error }, 'Health check failed');
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        error: 'Health check failed',
        services: {
          database: { status: 'unhealthy' },
          auditDatabase: { status: 'unhealthy' },
          redis: { status: 'unhealthy' },
          typesense: { status: 'unhealthy' }
        },
        system: {
          cpu: { usage: 0, cores: 0 },
          memory: { used: 0, total: 0, percentage: 0 },
          disk: { used: 0, total: 0, percentage: 0 }
        }
      });
    }
  });

  /**
   * Metrics endpoint - Prometheus format
   */
  fastify.get('/metrics', {
    schema: {
      description: 'Prometheus metrics endpoint - system metrics in Prometheus format', summary: 'Prometheus metrics', tags: ['Health'], response: {
        200: {
          type: 'string', description: 'Metrics in Prometheus format'
        }, 503: {
          type: 'string', description: 'Metrics generation failed'
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await healthService.getHealth();
      
      // Convert to Prometheus format
      const metrics = [
        `# HELP ordendirecta_up Service up status`,
        `# TYPE ordendirecta_up gauge`,
        `ordendirecta_up{environment="${health.environment}",version="${health.version}"} ${health.status === 'healthy' ? 1 : 0}`,
        
        `# HELP ordendirecta_uptime_seconds Service uptime in seconds`,
        `# TYPE ordendirecta_uptime_seconds counter`,
        `ordendirecta_uptime_seconds ${health.uptime}`,
        
        `# HELP ordendirecta_service_health Service health status`,
        `# TYPE ordendirecta_service_health gauge`,
        `ordendirecta_service_health{service="database"} ${health.services.database.status === 'healthy' ? 1 : 0}`,
        `ordendirecta_service_health{service="audit_database"} ${health.services.auditDatabase.status === 'healthy' ? 1 : 0}`,
        `ordendirecta_service_health{service="redis"} ${health.services.redis.status === 'healthy' ? 1 : 0}`,
        `ordendirecta_service_health{service="typesense"} ${health.services.typesense.status === 'healthy' ? 1 : 0}`,
        
        `# HELP ordendirecta_service_response_time_ms Service response time in milliseconds`,
        `# TYPE ordendirecta_service_response_time_ms gauge`,
        health.services.database.responseTime ? `ordendirecta_service_response_time_ms{service="database"} ${health.services.database.responseTime}` : '',
        health.services.auditDatabase.responseTime ? `ordendirecta_service_response_time_ms{service="audit_database"} ${health.services.auditDatabase.responseTime}` : '',
        health.services.redis.responseTime ? `ordendirecta_service_response_time_ms{service="redis"} ${health.services.redis.responseTime}` : '',
        health.services.typesense.responseTime ? `ordendirecta_service_response_time_ms{service="typesense"} ${health.services.typesense.responseTime}` : '',
        
        `# HELP ordendirecta_cpu_usage_percent CPU usage percentage`,
        `# TYPE ordendirecta_cpu_usage_percent gauge`,
        `ordendirecta_cpu_usage_percent ${health.system.cpu.usage}`,
        
        `# HELP ordendirecta_memory_usage_bytes Memory usage in bytes`,
        `# TYPE ordendirecta_memory_usage_bytes gauge`,
        `ordendirecta_memory_usage_bytes ${health.system.memory.used}`,
        
        `# HELP ordendirecta_memory_usage_percent Memory usage percentage`,
        `# TYPE ordendirecta_memory_usage_percent gauge`,
        `ordendirecta_memory_usage_percent ${health.system.memory.percentage}`,
        
        `# HELP ordendirecta_disk_usage_bytes Disk usage in bytes`,
        `# TYPE ordendirecta_disk_usage_bytes gauge`,
        `ordendirecta_disk_usage_bytes ${health.system.disk.used}`,
        
        `# HELP ordendirecta_disk_usage_percent Disk usage percentage`,
        `# TYPE ordendirecta_disk_usage_percent gauge`,
        `ordendirecta_disk_usage_percent ${health.system.disk.percentage}`
      ].filter(line => line).join('\n');
      
      return reply
        .code(200)
        .header('Content-Type', 'text/plain; version=0.0.4')
        .send(metrics);
    } catch (error: any) { logger.error({ error }, 'Metrics generation failed');
      return reply.code(503).send('# Metrics generation failed');
    }
  });
}
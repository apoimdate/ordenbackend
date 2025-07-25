import { buildApp } from './app';
import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

async function start() {
  try {
    // Connect to databases
    await connectDatabase();
    logger.info('Database connections established');

    // Build Fastify app
    const app = await buildApp();

    // Start server
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host
    });

    logger.info(`
🚀 OrdenDirecta Backend Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Server:     ${address}
🌍 Environment: ${config.node.env}
🔐 JWT:        Configured
🔍 Search:     Typesense
💾 Cache:      Redis
🛡️  Security:   Fraud Detection Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Health endpoints:
  GET /health  - Comprehensive health check
  GET /ready   - Readiness probe
  GET /live    - Liveness probe
  GET /metrics - Prometheus metrics
`);

    // Log startup metrics
    logger.info({
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime()
    }, 'Server startup metrics');

  } catch (error) { logger.fatal({ 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      } : error 
    }, 'Failed to start server');
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

// Start the server
start();
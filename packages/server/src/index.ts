/**
 * Supply Chain Commander - Server Entry Point
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { gameRoutes, chatRoutes, researchRoutes, settingsRoutes, stockRoutes } from './routes/index.js';
import { websocketRoutes, initGameLoopBroadcast } from './routes/websocket.js';
import { gameLoop } from './services/gameLoop.js';
import { initializePriceWorkerPool, shutdownWorkerPools, getPriceWorkerPool } from './workers/index.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST ?? '0.0.0.0';

async function bootstrap() {
  const isDev = process.env.NODE_ENV === 'development';
  
  const app = Fastify({
    logger: isDev
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          level: process.env.LOG_LEVEL ?? 'info',
        },
  });

  // Security plugins
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable for game assets
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  // WebSocket support
  await app.register(websocket);

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API status
  app.get('/api/v1/status', async () => {
    return {
      version: '0.1.0',
      gameEngine: 'ready',
      llmProvider: process.env.LLM_PROVIDER ?? 'openai',
    };
  });

  // Register API routes
  await app.register(gameRoutes);
  await app.register(chatRoutes);
  await app.register(researchRoutes);
  await app.register(settingsRoutes);
  await app.register(stockRoutes);
  
  // Register WebSocket routes for game state sync
  await app.register(websocketRoutes);
  
  // Initialize Worker Pool for parallel computing
  try {
    await initializePriceWorkerPool();
    const pool = getPriceWorkerPool();
    if (pool) {
      const stats = pool.getStats();
      app.log.info(`✅ Worker Pool initialized: ${stats.totalWorkers} workers ready for parallel computing`);
    } else {
      app.log.warn('⚠️ Worker Pool not available, using main thread for calculations');
    }
  } catch (error) {
    app.log.warn(`⚠️ Failed to initialize Worker Pool, using main thread fallback: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Initialize GameLoop broadcast system
  initGameLoopBroadcast();
  app.log.info('GameLoop initialized');

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      gameLoop.shutdown();
      await shutdownWorkerPools();
      await app.close();
      process.exit(0);
    });
  });

  // Start server
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🚀 Server running at http://${HOST}:${PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap().catch(console.error);
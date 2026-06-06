import { app } from './app';
import { env } from './lib/config/env.config';
import { logger } from './lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from './lib/logger/logger.constants';
import { prisma } from './lib/prisma/client';
import { initializeKeypair } from './modules/auth/infrastructure/services/local-keypair.service';

async function bootstrap(): Promise<void> {
  await initializeKeypair();

  await prisma.$queryRawUnsafe('SELECT 1');
  logger.info(LOG_EVENTS.DB_CONNECTED, { module: LOG_MODULES.SYSTEM }, {
    url: env.DATABASE_URL.replace(/\/\/.*@/, '//<credentials>@'),
  });

  const server = app.listen(env.PORT, () => {
    logger.info(LOG_EVENTS.SERVER_STARTED, { module: LOG_MODULES.SYSTEM }, {
      port: env.PORT,
      env: env.NODE_ENV,
      corsOrigin: env.CORS_ORIGIN,
    });
  });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(LOG_EVENTS.GRACEFUL_SHUTDOWN, { module: LOG_MODULES.SYSTEM }, { signal });
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

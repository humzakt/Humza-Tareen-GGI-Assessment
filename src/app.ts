import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './lib/config/env.config';
import { requestContextMiddleware } from './lib/middleware/request-context.middleware';
import { contentTypeMiddleware } from './lib/middleware/content-type.middleware';
import { timeoutMiddleware } from './lib/middleware/timeout.middleware';
import { createRateLimiter } from './lib/middleware/rate-limit.middleware';
import { errorHandlerMiddleware } from './lib/middleware/error-handler.middleware';
import { logger } from './lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from './lib/logger/logger.constants';
import { ContextRequest } from './lib/types/request.types';
import { authRouter } from './modules/auth/controllers/auth.controller';
import { chatRouter } from './modules/chat/controllers/chat.controller';
import { subscriptionRouter } from './modules/subscriptions/controllers/subscription.controller';
import { healthRouter } from './routes/health.route';
import { metricsRouter } from './routes/metrics.route';

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS
app.use(cors({
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Correlation-ID',
    'X-Request-Timestamp',
    'X-Request-Signature',
  ],
  exposedHeaders: ['X-Correlation-ID', 'X-Request-ID'],
  credentials: true,
}));

// 3. Body parser with size limit
app.use(express.json({ limit: '10kb' }));

// 4. Content-Type validation (POST/PUT/PATCH only)
app.use(contentTypeMiddleware);

// 5. Request timeout
app.use(timeoutMiddleware);

// 6. Request context injection
app.use(requestContextMiddleware);

// 7. Request lifecycle logging
app.use((req, _res, next) => {
  const ctx = (req as ContextRequest).context;
  logger.info(LOG_EVENTS.REQUEST_START, {
    module: LOG_MODULES.SYSTEM,
    correlationId: ctx?.correlationId,
    requestId: ctx?.requestId,
  }, { method: req.method, path: req.path, ip: req.ip });
  next();
});

// 8. Global rate limiting
app.use(createRateLimiter('global'));

// --- Public routes (no auth required) ---
app.use('/auth', authRouter);
app.use('/health', healthRouter);

// --- Protected routes ---
app.use('/api/chat', chatRouter);
app.use('/api/subscriptions', subscriptionRouter);
app.use('/admin/metrics', metricsRouter);

// 13. Response lifecycle logging
app.use((req, res, next) => {
  const ctx = (req as ContextRequest).context;
  res.on('finish', () => {
    const duration = ctx ? Date.now() - ctx.startTime : 0;
    logger.info(LOG_EVENTS.REQUEST_END, {
      module: LOG_MODULES.SYSTEM,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { method: req.method, path: req.path, statusCode: res.statusCode, durationMs: duration });
  });
  next();
});

// 14. Centralized error handler (must be last)
app.use(errorHandlerMiddleware);

export { app };

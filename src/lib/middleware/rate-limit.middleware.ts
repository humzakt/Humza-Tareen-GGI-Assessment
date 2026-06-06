import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { getRateLimitConfig, RateLimitGroup } from '../registries/rate-limit.registry';
import { AuthenticatedRequest } from '../types/request.types';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { ContextRequest } from '../types/request.types';

export function createRateLimiter(group: RateLimitGroup) {
  const config = getRateLimitConfig(group);

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      if (config.keyType === 'user') {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.id) {
          return authReq.user.id;
        }
      }
      return ipKeyGenerator(req.ip ?? '127.0.0.1');
    },
    handler: (req, res) => {
      const ctx = (req as ContextRequest).context;
      logger.warn(LOG_EVENTS.RATE_LIMIT_HIT, {
        module: LOG_MODULES.MIDDLEWARE,
        correlationId: ctx?.correlationId,
        requestId: ctx?.requestId,
        userId: (req as AuthenticatedRequest).user?.id,
      }, { group, method: req.method, path: req.path, ip: req.ip });

      res.status(429).json({
        success: false,
        data: null,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message,
          correlationId: ctx?.correlationId,
        },
      });
    },
  });
}

import { Request, Response, NextFunction } from 'express';
import { REQUEST_TIMEOUT_MS } from '../constants/time.constants';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { ContextRequest } from '../types/request.types';

export function timeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  const timeout = setTimeout(() => {
    const ctx = (req as ContextRequest).context;
    logger.error(LOG_EVENTS.TIMEOUT, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { method: req.method, path: req.path, timeoutMs: REQUEST_TIMEOUT_MS });

    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        data: null,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out.',
          correlationId: ctx?.correlationId,
        },
      });
    }
  }, REQUEST_TIMEOUT_MS);

  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));

  next();
}

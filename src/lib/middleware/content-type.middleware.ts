import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { ContextRequest } from '../types/request.types';
import { createAppError } from '../errors/error.template';

const EXEMPT_METHODS = ['GET', 'HEAD', 'DELETE', 'OPTIONS'];

export function contentTypeMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (EXEMPT_METHODS.includes(req.method)) {
    next();
    return;
  }

  const contentLength = req.headers['content-length'];
  if (!contentLength || contentLength === '0') {
    next();
    return;
  }

  const contentType = req.headers['content-type'];

  if (!contentType || !contentType.includes('application/json')) {
    const ctx = (req as ContextRequest).context;
    logger.warn(LOG_EVENTS.INVALID_CONTENT_TYPE, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { receivedType: contentType ?? 'none', method: req.method, path: req.path });

    const error = createAppError('INVALID_CONTENT_TYPE');
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
    return;
  }

  next();
}

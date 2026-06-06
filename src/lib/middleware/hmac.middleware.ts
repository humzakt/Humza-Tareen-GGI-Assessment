import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.config';
import { HEADERS } from '../constants/http.constants';
import { HMAC_TOLERANCE_MS } from '../constants/time.constants';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { ContextRequest } from '../types/request.types';
import { createAppError } from '../errors/error.template';

export function hmacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ctx = (req as ContextRequest).context;
  const timestamp = req.headers[HEADERS.REQUEST_TIMESTAMP] as string | undefined;
  const signature = req.headers[HEADERS.REQUEST_SIGNATURE] as string | undefined;

  if (!timestamp) {
    logger.warn(LOG_EVENTS.HMAC_REJECTED, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { reason: 'missing_timestamp', method: req.method, path: req.path });

    const error = createAppError('TIMESTAMP_EXPIRED');
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
    return;
  }

  if (!signature) {
    logger.warn(LOG_EVENTS.HMAC_REJECTED, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { reason: 'missing_signature', method: req.method, path: req.path });

    const error = createAppError('INVALID_SIGNATURE');
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
    return;
  }

  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();

  if (isNaN(requestTime) || Math.abs(now - requestTime) > HMAC_TOLERANCE_MS) {
    logger.warn(LOG_EVENTS.HMAC_REJECTED, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { reason: 'timestamp_drift', drift: Math.abs(now - requestTime), method: req.method, path: req.path });

    const error = createAppError('TIMESTAMP_EXPIRED');
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
    return;
  }

  const body = req.body ? JSON.stringify(req.body) : '';
  const payload = `${timestamp}${req.method}${req.originalUrl}${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', env.HMAC_SECRET)
    .update(payload)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );

  if (!isValid) {
    logger.warn(LOG_EVENTS.HMAC_REJECTED, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { reason: 'signature_mismatch', method: req.method, path: req.path });

    const error = createAppError('INVALID_SIGNATURE');
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
    return;
  }

  logger.debug(LOG_EVENTS.HMAC_VERIFIED, {
    module: LOG_MODULES.MIDDLEWARE,
    correlationId: ctx?.correlationId,
    requestId: ctx?.requestId,
  }, { method: req.method, path: req.path });

  next();
}

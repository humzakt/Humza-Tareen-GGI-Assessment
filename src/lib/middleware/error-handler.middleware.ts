import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/error.template';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { ContextRequest } from '../types/request.types';
import { errorResponse } from '../responses/response.template';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const ctx = (req as ContextRequest).context;

  if (err instanceof AppError) {
    logger.warn(LOG_EVENTS.REQUEST_END, {
      module: LOG_MODULES.SYSTEM,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, {
      error: err.code,
      status: err.status,
      message: err.message,
      method: req.method,
      path: req.path,
    });

    res.status(err.status).json(
      errorResponse(err.code, err.message, ctx?.correlationId, err.details),
    );
    return;
  }

  logger.error(LOG_EVENTS.REQUEST_END, {
    module: LOG_MODULES.SYSTEM,
    correlationId: ctx?.correlationId,
    requestId: ctx?.requestId,
  }, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });

  res.status(500).json(
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.', ctx?.correlationId),
  );
}

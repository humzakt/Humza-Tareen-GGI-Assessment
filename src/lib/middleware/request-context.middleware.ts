import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HEADERS } from '../constants/http.constants';
import { ContextRequest, RequestContext } from '../types/request.types';

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const correlationId =
    (req.headers[HEADERS.CORRELATION_ID] as string | undefined) ?? uuidv4();
  const requestId = uuidv4();

  const context: RequestContext = {
    requestId,
    correlationId,
    startTime: Date.now(),
  };

  (req as ContextRequest).context = context;

  _res.setHeader(HEADERS.CORRELATION_ID, correlationId);
  _res.setHeader(HEADERS.REQUEST_ID, requestId);

  next();
}

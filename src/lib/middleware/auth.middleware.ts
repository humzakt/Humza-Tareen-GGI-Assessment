import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { env } from '../config/env.config';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { AuthenticatedRequest, ContextRequest } from '../types/request.types';
import { createAppError } from '../errors/error.template';
import { getPublicKey } from '../../modules/auth/infrastructure/services/local-keypair.service';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ctx = (req as ContextRequest).context;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(LOG_EVENTS.AUTH_FAILURE, {
      module: LOG_MODULES.AUTH,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { reason: 'missing_token', method: req.method, path: req.path });

    const error = createAppError('UNAUTHORIZED');
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const publicKey = await getPublicKey();
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.user = {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as 'USER' | 'ADMIN',
    };

    logger.debug(LOG_EVENTS.AUTH_SUCCESS, {
      module: LOG_MODULES.AUTH,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
      userId: payload.sub as string,
    }, { email: payload.email, role: payload.role });

    next();
  } catch (err) {
    const reason = err instanceof jose.errors.JWTExpired ? 'token_expired' : 'token_invalid';
    const errorCode = reason === 'token_expired' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';

    logger.warn(LOG_EVENTS.AUTH_FAILURE, {
      module: LOG_MODULES.AUTH,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
    }, { reason, method: req.method, path: req.path });

    const error = createAppError(errorCode);
    res.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, correlationId: ctx?.correlationId },
    });
  }
}

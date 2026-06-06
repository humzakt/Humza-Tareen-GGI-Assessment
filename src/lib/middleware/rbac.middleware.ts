import { Request, Response, NextFunction } from 'express';
import { Permission, hasPermission } from '../registries/role.registry';
import { logger } from '../logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../logger/logger.constants';
import { AuthenticatedRequest, ContextRequest } from '../types/request.types';

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = (req as ContextRequest).context;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.', correlationId: ctx?.correlationId },
      });
      return;
    }

    if (!hasPermission(user.role, permission)) {
      logger.warn(LOG_EVENTS.RBAC_DENIED, {
        module: LOG_MODULES.MIDDLEWARE,
        correlationId: ctx?.correlationId,
        requestId: ctx?.requestId,
        userId: user.id,
      }, { permission, userRole: user.role, method: req.method, path: req.path });

      res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Required permission: ${permission}.`,
          correlationId: ctx?.correlationId,
        },
      });
      return;
    }

    logger.debug(LOG_EVENTS.RBAC_ALLOWED, {
      module: LOG_MODULES.MIDDLEWARE,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
      userId: user.id,
    }, { permission, userRole: user.role });

    next();
  };
}

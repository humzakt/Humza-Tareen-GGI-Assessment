import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../lib/middleware/validate.middleware';
import { registerSchema, loginSchema, refreshSchema, oauthCallbackQuerySchema } from './auth.schema';
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { MockOAuthLoginUseCase } from '../application/use-cases/mock-oauth-login.use-case';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import { PrismaRefreshTokenRepository } from '../infrastructure/repositories/prisma-refresh-token.repository';
import { success } from '../../../lib/responses/response.template';
import { ContextRequest } from '../../../lib/types/request.types';
import { logger } from '../../../lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../../../lib/logger/logger.constants';
import { getJWKS } from '../infrastructure/services/local-keypair.service';

const router = Router();
const userRepo = new PrismaUserRepository();
const refreshTokenRepo = new PrismaRefreshTokenRepository();

router.post(
  '/register',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = (req as ContextRequest).context;
      const useCase = new RegisterUseCase(userRepo, refreshTokenRepo);
      const result = await useCase.execute(req.body);

      logger.info(LOG_EVENTS.AUTH_SUCCESS, {
        module: LOG_MODULES.AUTH,
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
        userId: result.user.id,
      }, { action: 'register', email: result.user.email });

      res.status(201).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = (req as ContextRequest).context;
      const useCase = new LoginUseCase(userRepo, refreshTokenRepo);
      const result = await useCase.execute(req.body);

      logger.info(LOG_EVENTS.AUTH_SUCCESS, {
        module: LOG_MODULES.AUTH,
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
        userId: result.user.id,
      }, { action: 'login', email: result.user.email });

      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/refresh',
  validate({ body: refreshSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const useCase = new RefreshTokenUseCase(userRepo, refreshTokenRepo);
      const result = await useCase.execute(req.body.refreshToken);
      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/oauth/google/callback',
  validate({ query: oauthCallbackQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = (req as ContextRequest).context;
      const email = req.query.email as string;
      const useCase = new MockOAuthLoginUseCase(userRepo, refreshTokenRepo);
      const result = await useCase.execute(email);

      logger.info(LOG_EVENTS.AUTH_SUCCESS, {
        module: LOG_MODULES.AUTH,
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
        userId: result.user.id,
      }, { action: 'oauth_google_mock', email: result.user.email });

      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

router.get('/.well-known/jwks.json', async (_req: Request, res: Response): Promise<void> => {
  const jwks = await getJWKS();
  res.status(200).json(jwks);
});

export { router as authRouter };

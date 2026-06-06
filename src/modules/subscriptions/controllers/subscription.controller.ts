import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../lib/middleware/validate.middleware';
import { authMiddleware } from '../../../lib/middleware/auth.middleware';
import { hmacMiddleware } from '../../../lib/middleware/hmac.middleware';
import { requirePermission } from '../../../lib/middleware/rbac.middleware';
import { createRateLimiter } from '../../../lib/middleware/rate-limit.middleware';
import { createSubscriptionSchema, subscriptionIdParamSchema } from './subscription.schema';
import { CreateSubscriptionUseCase } from '../application/use-cases/create-subscription.use-case';
import { CancelSubscriptionUseCase } from '../application/use-cases/cancel-subscription.use-case';
import { RenewSubscriptionsUseCase } from '../application/use-cases/renew-subscriptions.use-case';
import { PrismaSubscriptionRepository } from '../infrastructure/repositories/prisma-subscription.repository';
import { success } from '../../../lib/responses/response.template';
import { AuthenticatedRequest } from '../../../lib/types/request.types';

const router = Router();
const subscriptionRepo = new PrismaSubscriptionRepository();
const subscriptionLimiter = createRateLimiter('subscriptions');

router.use(authMiddleware);
router.use(hmacMiddleware);
router.use(subscriptionLimiter);

router.post(
  '/',
  requirePermission('subscription:create'),
  validate({ body: createSubscriptionSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const useCase = new CreateSubscriptionUseCase(subscriptionRepo);
      const result = await useCase.execute({
        userId: authReq.user.id,
        tier: req.body.tier,
        billingCycle: req.body.billingCycle,
        autoRenew: req.body.autoRenew,
        correlationId: authReq.context.correlationId,
        requestId: authReq.context.requestId,
      });

      res.status(201).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/',
  requirePermission('subscription:read_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const subscriptions = await subscriptionRepo.findByUserId(authReq.user.id);
      res.status(200).json(success(subscriptions));
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/cancel',
  requirePermission('subscription:cancel_own'),
  validate({ params: subscriptionIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const useCase = new CancelSubscriptionUseCase(subscriptionRepo);
      const result = await useCase.execute({
        subscriptionId: req.params['id'] as string,
        userId: authReq.user.id,
        userRole: authReq.user.role,
        correlationId: authReq.context.correlationId,
        requestId: authReq.context.requestId,
      });

      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/renew',
  requirePermission('subscription:renew_all'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const useCase = new RenewSubscriptionsUseCase(subscriptionRepo);
      const result = await useCase.execute({
        correlationId: authReq.context.correlationId,
        requestId: authReq.context.requestId,
        userId: authReq.user.id,
      });

      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);

export { router as subscriptionRouter };

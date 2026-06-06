import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../lib/middleware/validate.middleware';
import { authMiddleware } from '../../../lib/middleware/auth.middleware';
import { hmacMiddleware } from '../../../lib/middleware/hmac.middleware';
import { requirePermission } from '../../../lib/middleware/rbac.middleware';
import { createRateLimiter } from '../../../lib/middleware/rate-limit.middleware';
import { sendMessageSchema, chatHistoryQuerySchema } from './chat.schema';
import { SendMessageUseCase } from '../application/use-cases/send-message.use-case';
import { PrismaChatRepository } from '../infrastructure/repositories/prisma-chat.repository';
import { success, paginated } from '../../../lib/responses/response.template';
import { AuthenticatedRequest } from '../../../lib/types/request.types';

const router = Router();
const chatRepo = new PrismaChatRepository();

const chatLimiter = createRateLimiter('chat');

router.use(authMiddleware);
router.use(hmacMiddleware);
router.use(chatLimiter);

router.post(
  '/',
  requirePermission('chat:send'),
  validate({ body: sendMessageSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const useCase = new SendMessageUseCase(chatRepo);
      const result = await useCase.execute({
        userId: authReq.user.id,
        question: req.body.question,
        correlationId: authReq.context.correlationId,
        requestId: authReq.context.requestId,
      });

      res.status(201).json(success({
        message: result.message,
        quota: { source: result.quotaSource, subscriptionId: result.subscriptionId },
      }));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/history',
  requirePermission('chat:read_own'),
  validate({ query: chatHistoryQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await chatRepo.findByUserId(authReq.user.id, page, limit);
      res.status(200).json(paginated(result.items, result.total, page, limit));
    } catch (err) {
      next(err);
    }
  },
);

export { router as chatRouter };

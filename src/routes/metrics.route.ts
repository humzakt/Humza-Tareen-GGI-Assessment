import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma/client';
import { authMiddleware } from '../lib/middleware/auth.middleware';
import { hmacMiddleware } from '../lib/middleware/hmac.middleware';
import { requirePermission } from '../lib/middleware/rbac.middleware';
import { success } from '../lib/responses/response.template';

const router = Router();

router.use(authMiddleware);
router.use(hmacMiddleware);
router.use(requirePermission('admin:metrics'));

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      totalUsers,
      totalMessages,
      activeSubscriptions,
      totalPayments,
      failedPayments,
      usageByType,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.chatMessage.count(),
      prisma.subscription.count({ where: { active: true } }),
      prisma.paymentLog.count(),
      prisma.paymentLog.count({ where: { success: false } }),
      prisma.usageLog.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
    ]);

    const metrics = {
      users: { total: totalUsers },
      messages: { total: totalMessages },
      subscriptions: { active: activeSubscriptions },
      payments: {
        total: totalPayments,
        failed: failedPayments,
        successRate: totalPayments > 0 ? ((totalPayments - failedPayments) / totalPayments * 100).toFixed(1) + '%' : 'N/A',
      },
      usage: {
        byType: usageByType.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(success(metrics));
  } catch (err) {
    next(err);
  }
});

export { router as metricsRouter };

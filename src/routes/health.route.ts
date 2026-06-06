import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma/client';

const router = Router();
const startTime = Date.now();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
  }

  const uptime = Math.floor((Date.now() - startTime) / 1000);

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime,
    database: dbStatus,
    version: '1.0.0',
  });
});

export { router as healthRouter };

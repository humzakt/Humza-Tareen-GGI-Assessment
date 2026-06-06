import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  tier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  autoRenew: z.boolean().default(true),
}).strict();

export const subscriptionIdParamSchema = z.object({
  id: z.string().uuid('Invalid subscription ID'),
});

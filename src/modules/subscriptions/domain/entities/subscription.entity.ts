import { SubscriptionTier, BillingCycle } from '../../../../lib/registries/subscription-tier.registry';

export interface SubscriptionEntity {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  maxMessages: number;
  remainingMessages: number;
  price: number;
  startDate: Date;
  endDate: Date;
  renewalDate: Date;
  autoRenew: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  userId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  autoRenew: boolean;
}

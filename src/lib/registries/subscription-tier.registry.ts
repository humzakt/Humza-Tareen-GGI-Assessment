export type SubscriptionTier = 'BASIC' | 'PRO' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface TierConfig {
  maxMessages: number;
  monthlyPrice: number;
  yearlyPrice: number;
  label: string;
}

const SUBSCRIPTION_TIERS = {
  BASIC: { maxMessages: 10, monthlyPrice: 9.99, yearlyPrice: 99.99, label: 'Basic' },
  PRO: { maxMessages: 100, monthlyPrice: 29.99, yearlyPrice: 299.99, label: 'Pro' },
  ENTERPRISE: {
    maxMessages: Infinity,
    monthlyPrice: 99.99,
    yearlyPrice: 999.99,
    label: 'Enterprise',
  },
} as const satisfies Record<SubscriptionTier, TierConfig>;

export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return SUBSCRIPTION_TIERS[tier];
}

export function isUnlimited(tier: SubscriptionTier): boolean {
  return getTierConfig(tier).maxMessages === Infinity;
}

export function getTierPrice(tier: SubscriptionTier, cycle: BillingCycle): number {
  const config = getTierConfig(tier);
  return cycle === 'MONTHLY' ? config.monthlyPrice : config.yearlyPrice;
}

export function isValidTier(tier: string): tier is SubscriptionTier {
  return tier in SUBSCRIPTION_TIERS;
}

export function isValidBillingCycle(cycle: string): cycle is BillingCycle {
  return cycle === 'MONTHLY' || cycle === 'YEARLY';
}

export const ALL_TIERS: SubscriptionTier[] = ['BASIC', 'PRO', 'ENTERPRISE'];
export const ALL_BILLING_CYCLES: BillingCycle[] = ['MONTHLY', 'YEARLY'];

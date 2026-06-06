import { FREE_MONTHLY_LIMIT, QUOTA_RESET_DAY } from '../../../../lib/constants/quota.constants';
import { isUnlimited } from '../../../../lib/registries/subscription-tier.registry';
import { createAppError } from '../../../../lib/errors/error.template';

export interface UserQuotaState {
  freeMessagesUsed: number;
  freeQuotaResetDate: Date;
}

export interface ActiveSubscription {
  id: string;
  tier: 'BASIC' | 'PRO' | 'ENTERPRISE';
  remainingMessages: number;
  active: boolean;
}

export interface QuotaDeductionResult {
  source: 'FREE' | 'BUNDLE';
  subscriptionId?: string;
  newFreeMessagesUsed?: number;
  newResetDate?: Date;
}

export class QuotaService {
  checkAndDeduct(
    userState: UserQuotaState,
    subscriptions: ActiveSubscription[],
  ): QuotaDeductionResult {
    const now = new Date();
    let { freeMessagesUsed, freeQuotaResetDate } = userState;

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), QUOTA_RESET_DAY);

    if (freeQuotaResetDate < currentMonthStart) {
      freeMessagesUsed = 0;
      freeQuotaResetDate = currentMonthStart;
    }

    if (freeMessagesUsed < FREE_MONTHLY_LIMIT) {
      return {
        source: 'FREE',
        newFreeMessagesUsed: freeMessagesUsed + 1,
        newResetDate: freeQuotaResetDate,
      };
    }

    const activeSubscriptions = subscriptions
      .filter((s) => s.active)
      .sort((a, b) => b.remainingMessages - a.remainingMessages);

    for (const sub of activeSubscriptions) {
      if (isUnlimited(sub.tier)) {
        return { source: 'BUNDLE', subscriptionId: sub.id };
      }
      if (sub.remainingMessages > 0) {
        return { source: 'BUNDLE', subscriptionId: sub.id };
      }
    }

    throw createAppError('QUOTA_EXHAUSTED');
  }
}

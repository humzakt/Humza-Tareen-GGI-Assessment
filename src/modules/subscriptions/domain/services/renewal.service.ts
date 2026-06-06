import { SubscriptionEntity } from '../entities/subscription.entity';
import { BillingService } from './billing.service';
import { getTierPrice } from '../../../../lib/registries/subscription-tier.registry';
import { BillingCycle } from '../../../../lib/registries/subscription-tier.registry';

export interface RenewalResult {
  subscriptionId: string;
  renewed: boolean;
  failureReason?: string;
  newEndDate?: Date;
}

export class RenewalService {
  private billingService = new BillingService();

  processRenewal(subscription: SubscriptionEntity): RenewalResult {
    if (!subscription.autoRenew || !subscription.active) {
      return { subscriptionId: subscription.id, renewed: false, failureReason: 'Not eligible for renewal' };
    }

    const amount = getTierPrice(subscription.tier, subscription.billingCycle);
    const paymentResult = this.billingService.simulatePayment(amount);

    if (!paymentResult.success) {
      return {
        subscriptionId: subscription.id,
        renewed: false,
        failureReason: paymentResult.failureReason,
      };
    }

    const newEndDate = calculateNewEndDate(subscription.endDate, subscription.billingCycle);

    return {
      subscriptionId: subscription.id,
      renewed: true,
      newEndDate,
    };
  }
}

export function calculateNewEndDate(currentEndDate: Date, billingCycle: BillingCycle): Date {
  const newDate = new Date(currentEndDate);
  if (billingCycle === 'MONTHLY') {
    newDate.setMonth(newDate.getMonth() + 1);
  } else {
    newDate.setFullYear(newDate.getFullYear() + 1);
  }
  return newDate;
}

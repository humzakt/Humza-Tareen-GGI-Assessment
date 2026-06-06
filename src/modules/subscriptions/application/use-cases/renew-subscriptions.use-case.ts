import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { calculateNewEndDate } from '../../domain/services/renewal.service';
import { MockPaymentGateway } from '../../infrastructure/services/mock-payment-gateway.service';
import { getTierConfig, getTierPrice } from '../../../../lib/registries/subscription-tier.registry';
import { logger } from '../../../../lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../../../../lib/logger/logger.constants';

interface RenewResult {
  processed: number;
  renewed: number;
  failed: number;
  details: Array<{ subscriptionId: string; success: boolean; reason?: string }>;
}

interface RenewInput {
  correlationId: string;
  requestId: string;
  userId: string;
}

export class RenewSubscriptionsUseCase {
  private paymentGateway = new MockPaymentGateway();

  constructor(private subscriptionRepo: ISubscriptionRepository) {}

  async execute(input: RenewInput): Promise<RenewResult> {
    const logCtx = {
      module: LOG_MODULES.SUBSCRIPTIONS,
      correlationId: input.correlationId,
      requestId: input.requestId,
      userId: input.userId,
    };

    const dueSubscriptions = await this.subscriptionRepo.findDueForRenewal();

    logger.info(LOG_EVENTS.RENEWAL_ATTEMPTED, logCtx, {
      count: dueSubscriptions.length,
    });

    const details: RenewResult['details'] = [];
    let renewed = 0;
    let failed = 0;

    for (const sub of dueSubscriptions) {
      const amount = getTierPrice(sub.tier, sub.billingCycle);
      const paymentResult = await this.paymentGateway.processPayment({
        userId: sub.userId,
        subscriptionId: sub.id,
        amount,
        correlationId: input.correlationId,
      });

      if (paymentResult.success) {
        const newEndDate = calculateNewEndDate(sub.endDate, sub.billingCycle);
        const tierConfig = getTierConfig(sub.tier);
        const maxMessages = tierConfig.maxMessages === Infinity ? 999999999 : tierConfig.maxMessages;

        await this.subscriptionRepo.update(sub.id, {
          endDate: newEndDate,
          renewalDate: newEndDate,
          startDate: sub.endDate,
          remainingMessages: maxMessages,
        });

        logger.info(LOG_EVENTS.PAYMENT_SUCCEEDED, logCtx, {
          subscriptionId: sub.id,
          amount,
          newEndDate: newEndDate.toISOString(),
        });

        renewed++;
        details.push({ subscriptionId: sub.id, success: true });
      } else {
        await this.subscriptionRepo.update(sub.id, { active: false });

        logger.warn(LOG_EVENTS.PAYMENT_FAILED, logCtx, {
          subscriptionId: sub.id,
          amount,
          reason: paymentResult.failureReason,
        });

        failed++;
        details.push({ subscriptionId: sub.id, success: false, reason: paymentResult.failureReason });
      }
    }

    return { processed: dueSubscriptions.length, renewed, failed, details };
  }
}

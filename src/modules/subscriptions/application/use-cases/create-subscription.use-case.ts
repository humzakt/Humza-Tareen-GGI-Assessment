import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SubscriptionEntity } from '../../domain/entities/subscription.entity';
import { getTierConfig, getTierPrice, SubscriptionTier, BillingCycle } from '../../../../lib/registries/subscription-tier.registry';
import { logger } from '../../../../lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../../../../lib/logger/logger.constants';

interface CreateSubscriptionInput {
  userId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  correlationId: string;
  requestId: string;
}

export class CreateSubscriptionUseCase {
  constructor(private subscriptionRepo: ISubscriptionRepository) {}

  async execute(input: CreateSubscriptionInput): Promise<SubscriptionEntity> {
    const tierConfig = getTierConfig(input.tier);
    const price = getTierPrice(input.tier, input.billingCycle);
    const now = new Date();
    const endDate = new Date(now);

    if (input.billingCycle === 'MONTHLY') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const subscription = await this.subscriptionRepo.create({
      userId: input.userId,
      tier: input.tier,
      billingCycle: input.billingCycle,
      autoRenew: input.autoRenew,
      maxMessages: tierConfig.maxMessages === Infinity ? 999999999 : tierConfig.maxMessages,
      price,
      startDate: now,
      endDate,
      renewalDate: endDate,
    });

    logger.info(LOG_EVENTS.SUBSCRIPTION_CREATED, {
      module: LOG_MODULES.SUBSCRIPTIONS,
      correlationId: input.correlationId,
      requestId: input.requestId,
      userId: input.userId,
    }, { subscriptionId: subscription.id, tier: input.tier, billingCycle: input.billingCycle });

    return subscription;
  }
}

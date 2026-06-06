import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SubscriptionEntity } from '../../domain/entities/subscription.entity';
import { createAppError } from '../../../../lib/errors/error.template';
import { logger } from '../../../../lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../../../../lib/logger/logger.constants';

interface CancelSubscriptionInput {
  subscriptionId: string;
  userId: string;
  userRole: 'USER' | 'ADMIN';
  correlationId: string;
  requestId: string;
}

export class CancelSubscriptionUseCase {
  constructor(private subscriptionRepo: ISubscriptionRepository) {}

  async execute(input: CancelSubscriptionInput): Promise<SubscriptionEntity> {
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId);

    if (!subscription) {
      throw createAppError('SUBSCRIPTION_NOT_FOUND', { id: input.subscriptionId });
    }

    if (input.userRole !== 'ADMIN' && subscription.userId !== input.userId) {
      throw createAppError('RESOURCE_FORBIDDEN');
    }

    const updated = await this.subscriptionRepo.update(input.subscriptionId, {
      autoRenew: false,
    });

    logger.info(LOG_EVENTS.SUBSCRIPTION_CANCELLED, {
      module: LOG_MODULES.SUBSCRIPTIONS,
      correlationId: input.correlationId,
      requestId: input.requestId,
      userId: input.userId,
    }, { subscriptionId: input.subscriptionId });

    return updated;
  }
}

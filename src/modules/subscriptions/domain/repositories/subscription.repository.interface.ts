import { SubscriptionEntity, CreateSubscriptionInput } from '../entities/subscription.entity';

export interface ISubscriptionRepository {
  create(input: CreateSubscriptionInput & { maxMessages: number; price: number; startDate: Date; endDate: Date; renewalDate: Date }): Promise<SubscriptionEntity>;
  findById(id: string): Promise<SubscriptionEntity | null>;
  findByUserId(userId: string): Promise<SubscriptionEntity[]>;
  findActiveByUserId(userId: string): Promise<SubscriptionEntity[]>;
  findDueForRenewal(): Promise<SubscriptionEntity[]>;
  update(id: string, data: Partial<Pick<SubscriptionEntity, 'autoRenew' | 'active' | 'remainingMessages' | 'endDate' | 'renewalDate' | 'startDate' | 'price'>>): Promise<SubscriptionEntity>;
}

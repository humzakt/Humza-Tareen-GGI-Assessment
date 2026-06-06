import { prisma } from '../../../../lib/prisma/client';
import { ISubscriptionRepository } from '../../domain/repositories/subscription.repository.interface';
import { SubscriptionEntity, CreateSubscriptionInput } from '../../domain/entities/subscription.entity';

export class PrismaSubscriptionRepository implements ISubscriptionRepository {
  async create(input: CreateSubscriptionInput & { maxMessages: number; price: number; startDate: Date; endDate: Date; renewalDate: Date }): Promise<SubscriptionEntity> {
    return prisma.subscription.create({
      data: {
        userId: input.userId,
        tier: input.tier,
        billingCycle: input.billingCycle,
        maxMessages: input.maxMessages,
        remainingMessages: input.maxMessages,
        price: input.price,
        startDate: input.startDate,
        endDate: input.endDate,
        renewalDate: input.renewalDate,
        autoRenew: input.autoRenew,
        active: true,
      },
    }) as unknown as SubscriptionEntity;
  }

  async findById(id: string): Promise<SubscriptionEntity | null> {
    return prisma.subscription.findUnique({ where: { id } }) as unknown as SubscriptionEntity | null;
  }

  async findByUserId(userId: string): Promise<SubscriptionEntity[]> {
    return prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as unknown as SubscriptionEntity[];
  }

  async findActiveByUserId(userId: string): Promise<SubscriptionEntity[]> {
    return prisma.subscription.findMany({
      where: { userId, active: true },
      orderBy: { remainingMessages: 'desc' },
    }) as unknown as SubscriptionEntity[];
  }

  async findDueForRenewal(): Promise<SubscriptionEntity[]> {
    return prisma.subscription.findMany({
      where: {
        active: true,
        autoRenew: true,
        endDate: { lte: new Date() },
      },
    }) as unknown as SubscriptionEntity[];
  }

  async update(id: string, data: Partial<Pick<SubscriptionEntity, 'autoRenew' | 'active' | 'remainingMessages' | 'endDate' | 'renewalDate' | 'startDate' | 'price'>>): Promise<SubscriptionEntity> {
    return prisma.subscription.update({
      where: { id },
      data,
    }) as unknown as SubscriptionEntity;
  }
}

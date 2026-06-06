import { RenewalService, calculateNewEndDate } from '../../../src/modules/subscriptions/domain/services/renewal.service';
import { SubscriptionEntity } from '../../../src/modules/subscriptions/domain/entities/subscription.entity';

describe('RenewalService', () => {
  let renewalService: RenewalService;

  beforeEach(() => {
    renewalService = new RenewalService();
  });

  it('should not renew if autoRenew is false', () => {
    const sub: SubscriptionEntity = {
      id: 'sub-1',
      userId: 'user-1',
      tier: 'BASIC',
      billingCycle: 'MONTHLY',
      maxMessages: 10,
      remainingMessages: 0,
      price: 9.99,
      startDate: new Date(),
      endDate: new Date(),
      renewalDate: new Date(),
      autoRenew: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = renewalService.processRenewal(sub);
    expect(result.renewed).toBe(false);
    expect(result.failureReason).toContain('Not eligible');
  });

  it('should not renew if subscription is inactive', () => {
    const sub: SubscriptionEntity = {
      id: 'sub-1',
      userId: 'user-1',
      tier: 'BASIC',
      billingCycle: 'MONTHLY',
      maxMessages: 10,
      remainingMessages: 0,
      price: 9.99,
      startDate: new Date(),
      endDate: new Date(),
      renewalDate: new Date(),
      autoRenew: true,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = renewalService.processRenewal(sub);
    expect(result.renewed).toBe(false);
  });

  it('should renew successfully when payment succeeds', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const endDate = new Date('2024-06-01');
    const sub: SubscriptionEntity = {
      id: 'sub-1',
      userId: 'user-1',
      tier: 'BASIC',
      billingCycle: 'MONTHLY',
      maxMessages: 10,
      remainingMessages: 0,
      price: 9.99,
      startDate: new Date('2024-05-01'),
      endDate,
      renewalDate: endDate,
      autoRenew: true,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = renewalService.processRenewal(sub);
    expect(result.renewed).toBe(true);
    expect(result.newEndDate).toBeDefined();
  });

  it('should fail renewal when payment fails', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
    const sub: SubscriptionEntity = {
      id: 'sub-1',
      userId: 'user-1',
      tier: 'PRO',
      billingCycle: 'MONTHLY',
      maxMessages: 100,
      remainingMessages: 0,
      price: 29.99,
      startDate: new Date(),
      endDate: new Date(),
      renewalDate: new Date(),
      autoRenew: true,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = renewalService.processRenewal(sub);
    expect(result.renewed).toBe(false);
    expect(result.failureReason).toBeDefined();
  });
});

describe('calculateNewEndDate', () => {
  it('should add one month for MONTHLY billing', () => {
    const current = new Date('2024-01-15');
    const result = calculateNewEndDate(current, 'MONTHLY');
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(15);
  });

  it('should add one year for YEARLY billing', () => {
    const current = new Date('2024-06-01');
    const result = calculateNewEndDate(current, 'YEARLY');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // June
  });
});

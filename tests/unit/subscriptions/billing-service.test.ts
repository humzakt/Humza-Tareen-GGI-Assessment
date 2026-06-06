import { BillingService } from '../../../src/modules/subscriptions/domain/services/billing.service';

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService();
  });

  it('should return success or failure result', () => {
    const result = billingService.simulatePayment(9.99);
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('should include failure reason on failure', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
    const result = billingService.simulatePayment(9.99);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBeDefined();
    expect(typeof result.failureReason).toBe('string');
  });

  it('should succeed when random is above failure rate', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = billingService.simulatePayment(9.99);
    expect(result.success).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });
});

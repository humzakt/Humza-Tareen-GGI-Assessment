import { QuotaService, UserQuotaState, ActiveSubscription } from '../../../src/modules/chat/domain/services/quota.service';
import { AppError } from '../../../src/lib/errors/error.template';

describe('QuotaService', () => {
  let quotaService: QuotaService;

  beforeEach(() => {
    quotaService = new QuotaService();
  });

  describe('Free quota', () => {
    it('should allow free message when under limit', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 0,
        freeQuotaResetDate: new Date(),
      };

      const result = quotaService.checkAndDeduct(state, []);
      expect(result.source).toBe('FREE');
      expect(result.newFreeMessagesUsed).toBe(1);
    });

    it('should allow up to 3 free messages', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 2,
        freeQuotaResetDate: new Date(),
      };

      const result = quotaService.checkAndDeduct(state, []);
      expect(result.source).toBe('FREE');
      expect(result.newFreeMessagesUsed).toBe(3);
    });

    it('should reset free quota on new month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: lastMonth,
      };

      const result = quotaService.checkAndDeduct(state, []);
      expect(result.source).toBe('FREE');
      expect(result.newFreeMessagesUsed).toBe(1);
    });
  });

  describe('Bundle quota', () => {
    it('should use subscription when free quota exhausted', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date(),
      };
      const subscriptions: ActiveSubscription[] = [
        { id: 'sub-1', tier: 'BASIC', remainingMessages: 5, active: true },
      ];

      const result = quotaService.checkAndDeduct(state, subscriptions);
      expect(result.source).toBe('BUNDLE');
      expect(result.subscriptionId).toBe('sub-1');
    });

    it('should use subscription with highest remaining messages', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date(),
      };
      const subscriptions: ActiveSubscription[] = [
        { id: 'sub-1', tier: 'BASIC', remainingMessages: 2, active: true },
        { id: 'sub-2', tier: 'PRO', remainingMessages: 50, active: true },
      ];

      const result = quotaService.checkAndDeduct(state, subscriptions);
      expect(result.source).toBe('BUNDLE');
      expect(result.subscriptionId).toBe('sub-2');
    });

    it('should use enterprise subscription (unlimited)', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date(),
      };
      const subscriptions: ActiveSubscription[] = [
        { id: 'sub-ent', tier: 'ENTERPRISE', remainingMessages: 999999999, active: true },
      ];

      const result = quotaService.checkAndDeduct(state, subscriptions);
      expect(result.source).toBe('BUNDLE');
      expect(result.subscriptionId).toBe('sub-ent');
    });

    it('should skip inactive subscriptions', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date(),
      };
      const subscriptions: ActiveSubscription[] = [
        { id: 'sub-1', tier: 'BASIC', remainingMessages: 5, active: false },
        { id: 'sub-2', tier: 'PRO', remainingMessages: 10, active: true },
      ];

      const result = quotaService.checkAndDeduct(state, subscriptions);
      expect(result.subscriptionId).toBe('sub-2');
    });
  });

  describe('Quota exhausted', () => {
    it('should throw QUOTA_EXHAUSTED when no quota available', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date(),
      };

      expect(() => quotaService.checkAndDeduct(state, [])).toThrow(AppError);
      try {
        quotaService.checkAndDeduct(state, []);
      } catch (err) {
        expect((err as AppError).code).toBe('QUOTA_EXHAUSTED');
        expect((err as AppError).status).toBe(403);
      }
    });

    it('should throw when all subscriptions are depleted', () => {
      const state: UserQuotaState = {
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date(),
      };
      const subscriptions: ActiveSubscription[] = [
        { id: 'sub-1', tier: 'BASIC', remainingMessages: 0, active: true },
      ];

      expect(() => quotaService.checkAndDeduct(state, subscriptions)).toThrow(AppError);
    });
  });
});

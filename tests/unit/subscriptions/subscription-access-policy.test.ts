import { SubscriptionAccessPolicy } from '../../../src/modules/subscriptions/domain/policies/subscription-access.policy';
import { AuthenticatedUser } from '../../../src/lib/types/request.types';

describe('SubscriptionAccessPolicy', () => {
  const regularUser: AuthenticatedUser = { id: 'user-1', email: 'user@test.com', role: 'USER' };
  const adminUser: AuthenticatedUser = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };

  describe('canCreate', () => {
    it('should allow any user to create subscriptions', () => {
      expect(SubscriptionAccessPolicy.canCreate(regularUser)).toBe(true);
      expect(SubscriptionAccessPolicy.canCreate(adminUser)).toBe(true);
    });
  });

  describe('canRead', () => {
    it('should allow user to read own subscriptions', () => {
      expect(SubscriptionAccessPolicy.canRead(regularUser, 'user-1')).toBe(true);
    });

    it('should deny user from reading other subscriptions', () => {
      expect(SubscriptionAccessPolicy.canRead(regularUser, 'other-user')).toBe(false);
    });

    it('should allow admin to read all subscriptions', () => {
      expect(SubscriptionAccessPolicy.canRead(adminUser, 'any-user')).toBe(true);
    });
  });

  describe('canCancel', () => {
    it('should allow user to cancel own subscription', () => {
      expect(SubscriptionAccessPolicy.canCancel(regularUser, 'user-1')).toBe(true);
    });

    it('should deny user from cancelling other subscriptions', () => {
      expect(SubscriptionAccessPolicy.canCancel(regularUser, 'other-user')).toBe(false);
    });

    it('should allow admin to cancel any subscription', () => {
      expect(SubscriptionAccessPolicy.canCancel(adminUser, 'other-user')).toBe(true);
    });
  });

  describe('canTriggerRenewal', () => {
    it('should deny regular user', () => {
      expect(SubscriptionAccessPolicy.canTriggerRenewal(regularUser)).toBe(false);
    });

    it('should allow admin', () => {
      expect(SubscriptionAccessPolicy.canTriggerRenewal(adminUser)).toBe(true);
    });
  });
});

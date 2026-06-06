import { ChatAccessPolicy } from '../../../src/modules/chat/domain/policies/chat-access.policy';
import { AuthenticatedUser } from '../../../src/lib/types/request.types';

describe('ChatAccessPolicy', () => {
  const regularUser: AuthenticatedUser = { id: 'user-1', email: 'user@test.com', role: 'USER' };
  const adminUser: AuthenticatedUser = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };

  describe('canSendMessage', () => {
    it('should allow any authenticated user to send messages', () => {
      expect(ChatAccessPolicy.canSendMessage(regularUser)).toBe(true);
      expect(ChatAccessPolicy.canSendMessage(adminUser)).toBe(true);
    });
  });

  describe('canReadHistory', () => {
    it('should allow user to read their own history', () => {
      expect(ChatAccessPolicy.canReadHistory(regularUser, 'user-1')).toBe(true);
    });

    it('should deny user from reading another user history', () => {
      expect(ChatAccessPolicy.canReadHistory(regularUser, 'other-user')).toBe(false);
    });

    it('should allow admin to read any user history', () => {
      expect(ChatAccessPolicy.canReadHistory(adminUser, 'user-1')).toBe(true);
      expect(ChatAccessPolicy.canReadHistory(adminUser, 'other-user')).toBe(true);
    });
  });
});

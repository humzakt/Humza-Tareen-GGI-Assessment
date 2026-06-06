import { AuthenticatedUser } from '../../../../lib/types/request.types';

export class ChatAccessPolicy {
  static canSendMessage(_user: AuthenticatedUser): boolean {
    return true;
  }

  static canReadHistory(user: AuthenticatedUser, resourceOwnerId: string): boolean {
    if (user.role === 'ADMIN') return true;
    return user.id === resourceOwnerId;
  }
}

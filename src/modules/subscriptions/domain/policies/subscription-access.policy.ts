import { AuthenticatedUser } from '../../../../lib/types/request.types';

export class SubscriptionAccessPolicy {
  static canCreate(_user: AuthenticatedUser): boolean {
    return true;
  }

  static canRead(user: AuthenticatedUser, resourceOwnerId: string): boolean {
    if (user.role === 'ADMIN') return true;
    return user.id === resourceOwnerId;
  }

  static canCancel(user: AuthenticatedUser, resourceOwnerId: string): boolean {
    if (user.role === 'ADMIN') return true;
    return user.id === resourceOwnerId;
  }

  static canTriggerRenewal(user: AuthenticatedUser): boolean {
    return user.role === 'ADMIN';
  }
}

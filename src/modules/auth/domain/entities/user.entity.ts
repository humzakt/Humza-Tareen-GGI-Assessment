import { Role } from '../../../../lib/registries/role.registry';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  authProvider: 'LOCAL' | 'GOOGLE_MOCK';
  freeMessagesUsed: number;
  freeQuotaResetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  role?: Role;
  authProvider?: 'LOCAL' | 'GOOGLE_MOCK';
}

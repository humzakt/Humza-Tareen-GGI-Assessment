export type Role = 'USER' | 'ADMIN';

export type Permission =
  | 'chat:send'
  | 'chat:read_own'
  | 'chat:read_all'
  | 'subscription:create'
  | 'subscription:read_own'
  | 'subscription:read_all'
  | 'subscription:cancel_own'
  | 'subscription:cancel_all'
  | 'subscription:renew_all'
  | 'admin:metrics'
  | 'admin:manage_users';

interface RoleConfig {
  label: string;
  permissions: Permission[];
}

const ROLES = {
  USER: {
    label: 'Regular User',
    permissions: [
      'chat:send',
      'chat:read_own',
      'subscription:create',
      'subscription:read_own',
      'subscription:cancel_own',
    ],
  },
  ADMIN: {
    label: 'Administrator',
    permissions: [
      'chat:send',
      'chat:read_own',
      'chat:read_all',
      'subscription:create',
      'subscription:read_own',
      'subscription:read_all',
      'subscription:cancel_own',
      'subscription:cancel_all',
      'subscription:renew_all',
      'admin:metrics',
      'admin:manage_users',
    ],
  },
} as const satisfies Record<Role, RoleConfig>;

export function getRoleConfig(role: Role): RoleConfig {
  return ROLES[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return getRoleConfig(role).permissions.includes(permission);
}

export function isValidRole(role: string): role is Role {
  return role in ROLES;
}

export const ALL_ROLES: Role[] = ['USER', 'ADMIN'];

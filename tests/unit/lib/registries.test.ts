import { getErrorConfig, isValidErrorCode } from '../../../src/lib/registries/error-code.registry';
import { getTierConfig, isUnlimited, getTierPrice, isValidTier, isValidBillingCycle } from '../../../src/lib/registries/subscription-tier.registry';
import { getRoleConfig, hasPermission, isValidRole } from '../../../src/lib/registries/role.registry';
import { getRateLimitConfig, isValidRateLimitGroup } from '../../../src/lib/registries/rate-limit.registry';

describe('Error Code Registry', () => {
  it('should return correct config for QUOTA_EXHAUSTED', () => {
    const config = getErrorConfig('QUOTA_EXHAUSTED');
    expect(config.status).toBe(403);
    expect(config.template).toContain('quota exhausted');
  });

  it('should return correct config for UNAUTHORIZED', () => {
    const config = getErrorConfig('UNAUTHORIZED');
    expect(config.status).toBe(401);
  });

  it('should validate known error codes', () => {
    expect(isValidErrorCode('QUOTA_EXHAUSTED')).toBe(true);
    expect(isValidErrorCode('INVALID_CODE_XYZ')).toBe(false);
  });
});

describe('Subscription Tier Registry', () => {
  it('should return BASIC config with 10 messages', () => {
    const config = getTierConfig('BASIC');
    expect(config.maxMessages).toBe(10);
    expect(config.monthlyPrice).toBe(9.99);
    expect(config.label).toBe('Basic');
  });

  it('should return PRO config with 100 messages', () => {
    const config = getTierConfig('PRO');
    expect(config.maxMessages).toBe(100);
    expect(config.monthlyPrice).toBe(29.99);
  });

  it('should return ENTERPRISE as unlimited', () => {
    expect(isUnlimited('ENTERPRISE')).toBe(true);
    expect(isUnlimited('BASIC')).toBe(false);
    expect(isUnlimited('PRO')).toBe(false);
  });

  it('should return correct prices for billing cycles', () => {
    expect(getTierPrice('BASIC', 'MONTHLY')).toBe(9.99);
    expect(getTierPrice('BASIC', 'YEARLY')).toBe(99.99);
    expect(getTierPrice('PRO', 'MONTHLY')).toBe(29.99);
  });

  it('should validate tier strings', () => {
    expect(isValidTier('BASIC')).toBe(true);
    expect(isValidTier('INVALID')).toBe(false);
  });

  it('should validate billing cycle strings', () => {
    expect(isValidBillingCycle('MONTHLY')).toBe(true);
    expect(isValidBillingCycle('WEEKLY')).toBe(false);
  });
});

describe('Role Registry', () => {
  it('should return USER permissions', () => {
    const config = getRoleConfig('USER');
    expect(config.permissions).toContain('chat:send');
    expect(config.permissions).toContain('subscription:create');
    expect(config.permissions).not.toContain('admin:metrics');
  });

  it('should return ADMIN permissions including admin access', () => {
    const config = getRoleConfig('ADMIN');
    expect(config.permissions).toContain('admin:metrics');
    expect(config.permissions).toContain('chat:read_all');
    expect(config.permissions).toContain('subscription:renew_all');
  });

  it('should check permissions correctly', () => {
    expect(hasPermission('USER', 'chat:send')).toBe(true);
    expect(hasPermission('USER', 'admin:metrics')).toBe(false);
    expect(hasPermission('ADMIN', 'admin:metrics')).toBe(true);
  });

  it('should validate role strings', () => {
    expect(isValidRole('USER')).toBe(true);
    expect(isValidRole('SUPERADMIN')).toBe(false);
  });
});

describe('Rate Limit Registry', () => {
  it('should return auth config with IP-based limiting', () => {
    const config = getRateLimitConfig('auth');
    expect(config.max).toBe(10);
    expect(config.keyType).toBe('ip');
    expect(config.windowMs).toBe(15 * 60 * 1000);
  });

  it('should return chat config with user-based limiting', () => {
    const config = getRateLimitConfig('chat');
    expect(config.max).toBe(30);
    expect(config.keyType).toBe('user');
  });

  it('should validate rate limit groups', () => {
    expect(isValidRateLimitGroup('auth')).toBe(true);
    expect(isValidRateLimitGroup('unknown')).toBe(false);
  });
});

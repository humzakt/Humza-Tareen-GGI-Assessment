export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyType: 'ip' | 'user' | 'ip-and-user';
  message: string;
}

const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    keyType: 'ip' as const,
    message: 'Too many authentication attempts. Try again in 15 minutes.',
  },
  chat: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyType: 'user' as const,
    message: 'Chat rate limit exceeded. Try again in 1 minute.',
  },
  subscriptions: {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    keyType: 'user' as const,
    message: 'Subscription rate limit exceeded. Try again in 1 minute.',
  },
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    keyType: 'ip' as const,
    message: 'Too many requests. Try again later.',
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitGroup = keyof typeof RATE_LIMITS;

export function getRateLimitConfig(group: RateLimitGroup): RateLimitConfig {
  return RATE_LIMITS[group];
}

export function isValidRateLimitGroup(group: string): group is RateLimitGroup {
  return group in RATE_LIMITS;
}

export const ALL_RATE_LIMIT_GROUPS: RateLimitGroup[] = Object.keys(
  RATE_LIMITS,
) as RateLimitGroup[];

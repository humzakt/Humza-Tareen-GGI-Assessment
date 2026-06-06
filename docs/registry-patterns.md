# Registry Patterns

This document explains the registry pattern used throughout the Secure Production-Grade Backend System. Registries are the **single source of truth** for key→value mappings, replacing scattered constants, magic strings, and switch statements.

---

## Table of Contents

1. [What Is a Registry?](#what-is-a-registry)
2. [Registry vs Constants](#registry-vs-constants)
3. [The Standard Pattern](#the-standard-pattern)
4. [Built-In Registries](#built-in-registries)
5. [How to Add New Entries](#how-to-add-new-entries)
6. [How to Create a New Registry](#how-to-create-a-new-registry)
7. [Testing Registries](#testing-registries)
8. [Common Mistakes](#common-mistakes)

---

## What Is a Registry?

A registry is a **typed lookup table** paired with **accessor functions**. It centralizes mappings that would otherwise be duplicated across controllers, services, and middleware.

### Anatomy

```
registry.ts
├── Type definitions (key union, value interface)
├── Private lookup table (const object with `as const satisfies`)
├── Primary accessor (getXConfig(key))
├── Derived accessors (isUnlimited(), getAllKeys())
└── Optional validation (assertValidKey())
```

### Why Registries?

| Problem | Registry Solution |
|---------|------------------|
| Same switch statement in 5 files | One lookup table, one accessor |
| Magic numbers (`403`, `9.99`) scattered | Named config objects with types |
| Adding a new error code requires editing 3 files | Add one entry to `error-code.registry.ts` |
| Typos in string literals (`'BASCI'`) | TypeScript union type catches at compile time |
| Inconsistent messages for same error | Template string in one place |

---

## Registry vs Constants

Use this decision table every time you need to store a value:

| Question | Answer | Use |
|----------|--------|-----|
| Is it a single primitive value? | Yes | `*.constants.ts` |
| Is it a frozen list of allowed values? | Yes | `*.constants.ts` |
| Does it map keys to different configs? | Yes | `*.registry.ts` |
| Do you need a lookup function? | Yes | `*.registry.ts` |
| Is the value computed at runtime? | Yes | `*.registry.ts` (accessor function) |
| Is it used in exactly one file? | Yes | Inline or local const (no file needed) |

### Examples

```typescript
// ✅ constants.ts — single values, no lookup needed
export const FREE_MONTHLY_LIMIT = 3 as const;
export const HMAC_TOLERANCE_MS = 5 * 60 * 1000 as const;
export const HEADER_CORRELATION_ID = 'X-Correlation-ID' as const;

// ✅ registry.ts — key maps to different configs
export function getTierConfig(tier: SubscriptionTier): TierConfig { ... }
export function getErrorConfig(code: ErrorCode): ErrorConfig { ... }

// ❌ WRONG — lookup function in constants.ts
export function getTierPrice(tier: string): number { ... }  // belongs in registry.ts

// ❌ WRONG — mapping table in constants.ts
export const TIER_PRICES = { BASIC: 9.99, PRO: 29.99 };   // belongs in registry.ts
```

---

## The Standard Pattern

Every registry follows this exact structure:

### Step 1: Define Types

```typescript
// src/lib/types/subscription.types.ts (if shared) or top of registry file

export type SubscriptionTier = 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface TierConfig {
  maxMessages: number;
  price: number;
  label: string;
}
```

### Step 2: Define the Lookup Table

```typescript
const SUBSCRIPTION_TIERS = {
  BASIC:      { maxMessages: 10,       price: 9.99,   label: 'Basic' },
  PRO:        { maxMessages: 100,      price: 29.99,  label: 'Pro' },
  ENTERPRISE: { maxMessages: Infinity, price: 99.99,  label: 'Enterprise' },
} as const satisfies Record<SubscriptionTier, TierConfig>;
```

**Key elements:**

| Element | Purpose |
|---------|---------|
| `const` (not exported) | Encapsulation — external code uses accessors only |
| `as const` | Preserves literal types, prevents mutation |
| `satisfies Record<K, V>` | Compile-time check that all keys are covered with correct value shapes |

### Step 3: Export Accessor Functions

```typescript
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return SUBSCRIPTION_TIERS[tier];
}

export function isUnlimited(tier: SubscriptionTier): boolean {
  return getTierConfig(tier).maxMessages === Infinity;
}

export function getAllTiers(): SubscriptionTier[] {
  return Object.keys(SUBSCRIPTION_TIERS) as SubscriptionTier[];
}
```

### Why Not Export the Table Directly?

```typescript
// ❌ Exporting the raw table
export const SUBSCRIPTION_TIERS = { ... };
// Problems:
// - Callers can mutate if not frozen
// - No place to add validation or computed fields
// - Temptation to access SUBSCRIPTION_TIERS['BASIC'] directly everywhere

// ✅ Accessor function
export function getTierConfig(tier: SubscriptionTier): TierConfig { ... }
// Benefits:
// - Single access point (can add logging, validation, caching later)
// - TypeScript enforces valid keys at call site
// - Easy to mock in tests
```

---

## Built-In Registries

### `subscription-tier.registry.ts`

**Location:** `src/lib/registries/subscription-tier.registry.ts`

**Purpose:** Maps subscription tiers to their configuration (message limits, pricing, labels).

```typescript
import type { SubscriptionTier, TierConfig } from '../types/subscription.types';

const SUBSCRIPTION_TIERS = {
  BASIC:      { maxMessages: 10,       price: 9.99,   label: 'Basic' },
  PRO:        { maxMessages: 100,      price: 29.99,  label: 'Pro' },
  ENTERPRISE: { maxMessages: Infinity, price: 99.99,  label: 'Enterprise' },
} as const satisfies Record<SubscriptionTier, TierConfig>;

export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return SUBSCRIPTION_TIERS[tier];
}

export function isUnlimited(tier: SubscriptionTier): boolean {
  return getTierConfig(tier).maxMessages === Infinity;
}

export function getAllTiers(): SubscriptionTier[] {
  return Object.keys(SUBSCRIPTION_TIERS) as SubscriptionTier[];
}
```

**Used by:**
- `CreateSubscriptionUseCase` — set `maxMessages` and `price` on creation
- `QuotaService` — check if tier is unlimited before deducting
- `subscription.schema.ts` — validate `tier` enum values
- `GET /admin/metrics` — aggregate subscription counts by tier

---

### `error-code.registry.ts`

**Location:** `src/lib/registries/error-code.registry.ts`

**Purpose:** Maps error codes to HTTP status codes and message templates.

```typescript
import type { ErrorCode, ErrorConfig } from '../types/error.types';

const ERROR_CODES = {
  VALIDATION_ERROR:        { status: 400, template: 'Request validation failed.' },
  AUTH_MISSING_TOKEN:      { status: 401, template: 'Authentication token is required.' },
  AUTH_INVALID_TOKEN:      { status: 401, template: 'Invalid or expired authentication token.' },
  AUTH_INVALID_CREDENTIALS:{ status: 401, template: 'Invalid email or password.' },
  AUTH_EMAIL_EXISTS:       { status: 409, template: 'An account with this email already exists.' },
  AUTH_INVALID_REFRESH_TOKEN: { status: 401, template: 'Invalid or expired refresh token.' },
  HMAC_MISSING_TIMESTAMP:  { status: 401, template: 'X-Request-Timestamp header is required.' },
  HMAC_MISSING_SIGNATURE:  { status: 401, template: 'X-Request-Signature header is required.' },
  HMAC_TIMESTAMP_EXPIRED:  { status: 401, template: 'Request timestamp has expired.' },
  INVALID_SIGNATURE:       { status: 401, template: 'Request signature verification failed.' },
  FORBIDDEN:               { status: 403, template: 'You do not have permission to perform this action.' },
  QUOTA_EXHAUSTED:         { status: 403, template: 'Monthly quota exhausted. Purchase a subscription bundle.' },
  SUBSCRIPTION_INACTIVE:   { status: 403, template: 'Subscription {id} is inactive.' },
  SUBSCRIPTION_NOT_FOUND:  { status: 404, template: 'Subscription not found.' },
  NOT_FOUND:               { status: 404, template: 'Resource not found.' },
  RATE_LIMIT_EXCEEDED:     { status: 429, template: 'Too many requests. Please try again later.' },
  PAYLOAD_TOO_LARGE:       { status: 413, template: 'Request body exceeds maximum allowed size.' },
  REQUEST_TIMEOUT:         { status: 408, template: 'Request timed out.' },
  INVALID_CONTENT_TYPE:    { status: 415, template: 'Content-Type must be application/json.' },
  INTERNAL_ERROR:          { status: 500, template: 'An unexpected error occurred.' },
} as const satisfies Record<ErrorCode, ErrorConfig>;

export function getErrorConfig(code: ErrorCode): ErrorConfig {
  return ERROR_CODES[code];
}

export function getAllErrorCodes(): ErrorCode[] {
  return Object.keys(ERROR_CODES) as ErrorCode[];
}

export function isClientError(code: ErrorCode): boolean {
  return getErrorConfig(code).status >= 400 && getErrorConfig(code).status < 500;
}
```

**Used by:**
- `error.template.ts` — `createAppError()` looks up status and message
- `error-handler.middleware.ts` — maps thrown errors to HTTP responses
- All domain services and use cases — `throw createAppError('QUOTA_EXHAUSTED')`

**Template interpolation:**

```typescript
// Template: 'Subscription {id} is inactive.'
createAppError('SUBSCRIPTION_INACTIVE', { id: '990e8400-...' });
// Produces: 'Subscription 990e8400-... is inactive.'
```

---

### `rate-limit.registry.ts`

**Location:** `src/lib/registries/rate-limit.registry.ts`

**Purpose:** Maps route groups to rate limiting configuration.

```typescript
import type { RouteGroup, RateLimitConfig } from '../types/rate-limit.types';

const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,
    keyGenerator: 'ip' as const,
    message: 'Too many authentication attempts.',
  },
  chat: {
    windowMs: 60 * 1000,       // 1 minute
    max: 30,
    keyGenerator: 'user' as const,
    message: 'Too many chat requests.',
  },
  subscriptions: {
    windowMs: 60 * 1000,       // 1 minute
    max: 20,
    keyGenerator: 'user' as const,
    message: 'Too many subscription requests.',
  },
  global: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,
    keyGenerator: 'ip' as const,
    message: 'Too many requests.',
  },
} as const satisfies Record<RouteGroup, RateLimitConfig>;

export function getRateLimitConfig(group: RouteGroup): RateLimitConfig {
  return RATE_LIMITS[group];
}

export function getAllRouteGroups(): RouteGroup[] {
  return Object.keys(RATE_LIMITS) as RouteGroup[];
}
```

**Used by:**
- `rate-limit.middleware.ts` — factory creates `express-rate-limit` instances per route group
- `app.ts` — attaches correct limiter to each route prefix

---

### `role.registry.ts`

**Location:** `src/lib/registries/role.registry.ts`

**Purpose:** Maps route groups to allowed roles and defines role permissions.

```typescript
import type { Role, RouteGroup, Permission } from '../types/role.types';

const ROUTE_ROLES = {
  'admin:metrics':              ['ADMIN'],
  'admin:subscriptions:renew':  ['ADMIN'],
  'api:chat':                   ['USER', 'ADMIN'],
  'api:subscriptions':          ['USER', 'ADMIN'],
  'api:chat:history:all':       ['ADMIN'],
} as const satisfies Record<RouteGroup, readonly Role[]>;

const ROLE_PERMISSIONS = {
  USER:  ['chat:send', 'chat:history:own', 'subscription:create', 'subscription:read:own', 'subscription:cancel:own'],
  ADMIN: ['chat:send', 'chat:history:all', 'subscription:create', 'subscription:read:all', 'subscription:cancel:all', 'admin:metrics', 'admin:renew'],
} as const satisfies Record<Role, readonly Permission[]>;

export function getAllowedRoles(group: RouteGroup): readonly Role[] {
  return ROUTE_ROLES[group];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isRoleAllowed(role: Role, group: RouteGroup): boolean {
  return getAllowedRoles(group).includes(role);
}
```

**Used by:**
- `rbac.middleware.ts` — checks `isRoleAllowed(req.user.role, routeGroup)`
- Domain policies — checks `hasPermission(user.role, 'subscription:cancel:all')`

---

## How to Add New Entries

### Adding a New Error Code

1. **Add the code to the `ErrorCode` type union:**

```typescript
// src/lib/types/error.types.ts
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'QUOTA_EXHAUSTED'
  | 'PAYMENT_DECLINED'  // ← new
  | ... ;
```

2. **Add the entry to the registry:**

```typescript
// src/lib/registries/error-code.registry.ts
const ERROR_CODES = {
  // ... existing entries
  PAYMENT_DECLINED: { status: 402, template: 'Payment was declined for subscription {id}.' },
} as const satisfies Record<ErrorCode, ErrorConfig>;
```

TypeScript will error if you forget step 2 (the `satisfies Record<ErrorCode, ...>` ensures all codes are covered).

3. **Use it:**

```typescript
throw createAppError('PAYMENT_DECLINED', { id: subscription.id });
```

4. **Document it in `docs/api-reference.md`.**

5. **Add a unit test:**

```typescript
it('should return correct config for PAYMENT_DECLINED', () => {
  const config = getErrorConfig('PAYMENT_DECLINED');
  expect(config.status).toBe(402);
  expect(config.template).toContain('declined');
});
```

### Adding a New Subscription Tier

1. Add to `SubscriptionTier` type union
2. Add entry to `SUBSCRIPTION_TIERS` in registry
3. Update Zod schema enum in `subscription.schema.ts`
4. Update Prisma schema enum if persisted
5. Add unit test
6. Update API reference docs

### Adding a New Rate Limit Group

1. Add to `RouteGroup` type union
2. Add entry to `RATE_LIMITS` in registry
3. Attach limiter in `app.ts` for the new route prefix
4. Add integration test verifying 429 response

---

## How to Create a New Registry

Follow this checklist when a new mapping emerges:

```
□ 1. Identify the key type (string union)
□ 2. Identify the value interface
□ 3. Create src/lib/registries/<name>.registry.ts
□ 4. Define private lookup table with `as const satisfies Record<K, V>`
□ 5. Export get<Name>Config() accessor
□ 6. Export any derived helpers (isX, getAllX, hasX)
□ 7. Add types to src/lib/types/ if shared
□ 8. Write unit tests in tests/unit/lib/
□ 9. Document in this file
□ 10. Remove any switch statements or duplicate constants replaced by this registry
```

### Template for a New Registry

```typescript
// src/lib/registries/<name>.registry.ts

import type { MyKey, MyConfig } from '../types/<name>.types';

const MY_REGISTRY = {
  KEY_A: { field1: 'value1', field2: 42 },
  KEY_B: { field1: 'value2', field2: 99 },
} as const satisfies Record<MyKey, MyConfig>;

export function getMyConfig(key: MyKey): MyConfig {
  return MY_REGISTRY[key];
}

export function getAllMyKeys(): MyKey[] {
  return Object.keys(MY_REGISTRY) as MyKey[];
}
```

---

## Testing Registries

Every registry must have unit tests verifying:

```typescript
// tests/unit/lib/error-code.registry.test.ts

import { getErrorConfig, getAllErrorCodes, isClientError } from '@lib/registries/error-code.registry';

describe('error-code.registry', () => {
  it('should return correct config for every error code', () => {
    for (const code of getAllErrorCodes()) {
      const config = getErrorConfig(code);
      expect(config.status).toBeGreaterThanOrEqual(400);
      expect(config.template).toBeTruthy();
    }
  });

  it('should return 403 for QUOTA_EXHAUSTED', () => {
    expect(getErrorConfig('QUOTA_EXHAUSTED').status).toBe(403);
  });

  it('should identify client errors', () => {
    expect(isClientError('VALIDATION_ERROR')).toBe(true);
    expect(isClientError('INTERNAL_ERROR')).toBe(false);
  });
});
```

### Test Checklist per Registry

- [ ] Every key returns a valid config
- [ ] Derived helpers return correct boolean/results
- [ ] `getAllKeys()` returns complete list
- [ ] TypeScript compilation fails if a key is missing from the table (verified by `satisfies`)

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Exporting the raw lookup table | Keep it private; export accessors only |
| Using `as const` without `satisfies` | Add `satisfies Record<K, V>` for exhaustiveness |
| Putting accessor functions in `constants.ts` | Move to `registry.ts` |
| Duplicating registry data in Zod schemas | Import `getAllTiers()` for `z.enum()` |
| `switch` statement instead of registry lookup | Replace with `getXConfig(key)` |
| Hardcoded HTTP status in controller | Use `getErrorConfig(code).status` via template |
| Adding entry to registry but not to type union | `satisfies` will catch this at compile time |
| Adding entry to type union but not to registry | `satisfies` will catch this at compile time |

---

## Related Documentation

- [Code Standards](./code-standards.md) — File naming rules (`*.constants.ts` vs `*.registry.ts`)
- [Architecture](./architecture.md) — Where registries fit in `src/lib/`
- [Testing](./testing.md) — Registry unit test requirements
- [API Reference](./api-reference.md) — Error codes defined in registry

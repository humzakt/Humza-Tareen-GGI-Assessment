# Code Standards

This document defines naming conventions, file organization rules, type ownership policies, and module boundary guidelines for the Secure Production-Grade Backend System.

All contributors must follow these standards. ESLint and Prettier enforce formatting; this document enforces architecture and naming.

---

## Table of Contents

1. [File Naming Conventions](#file-naming-conventions)
2. [Type Ownership](#type-ownership)
3. [Module Boundaries](#module-boundaries)
4. [Import Rules](#import-rules)
5. [Code Style](#code-style)
6. [Error Handling Standards](#error-handling-standards)
7. [Logging Standards](#logging-standards)
8. [Directory Structure Reference](#directory-structure-reference)
9. [Anti-Patterns](#anti-patterns)

---

## File Naming Conventions

Every source file uses a **suffix** that declares its purpose. The suffix is mandatory — it enables instant recognition of a file's role.

### `*.constants.ts` — Pure Constant Values

**Rule:** Export only primitive values, enums, and frozen objects. **No functions. No logic.**

```typescript
// src/lib/constants/quota.constants.ts

export const FREE_MONTHLY_LIMIT = 3 as const;

export const QUOTA_RESET_DAY = 1 as const; // 1st of each month

export const SUBSCRIPTION_TIERS = ['BASIC', 'PRO', 'ENTERPRISE'] as const;
```

| Allowed | Not Allowed |
|---------|-------------|
| `export const MAX = 10` | `export function getMax()` |
| `export const HEADERS = { ... } as const` | `export const config = computeConfig()` |
| `export enum Role { USER, ADMIN }` | Any function, class, or side effect |

**When to use:** Single values, magic number elimination, header name strings, enum-like unions.

**When NOT to use:** Anything requiring computation, lookup, or transformation — use a registry instead.

---

### `*.registry.ts` — Lookup Tables with Accessor Functions

**Rule:** Single source of truth for mappings. Contains a `const` lookup table and typed accessor functions.

```typescript
// src/lib/registries/subscription-tier.registry.ts

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

| Allowed | Not Allowed |
|---------|-------------|
| `as const satisfies Record<K, V>` | Scattered switch statements duplicating registry data |
| Typed accessor functions | Direct export of the raw lookup table (use accessors) |
| Derived helper functions (`isUnlimited`) | Business logic (belongs in domain services) |

**When to use:** Error codes, rate limits, subscription tiers, role permissions — any key→value mapping used in multiple places.

See [Registry Patterns](./registry-patterns.md) for full guidelines.

---

### `*.template.ts` — Reusable Factory/Builder Patterns

**Rule:** Factory functions that produce typed, consistent output shapes. No business logic.

```typescript
// src/lib/responses/response.template.ts

import type { ApiResponse, ResponseMeta } from '../types/response.types';

export function success<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return { success: true, data, meta: meta ?? null, error: null };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    success: true,
    data: items,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
    error: null,
  };
}
```

```typescript
// src/lib/errors/error.template.ts

import { getErrorConfig } from '../registries/error-code.registry';
import type { ErrorCode, AppError } from '../types/error.types';

export function createAppError(
  code: ErrorCode,
  details?: Record<string, unknown>
): AppError {
  const config = getErrorConfig(code);
  return {
    code,
    status: config.status,
    message: interpolate(config.template, details),
    details: details ?? {},
  };
}
```

**When to use:** API response envelopes, error objects, log entry construction.

**Rule for controllers:** Never construct response JSON manually. Always use templates.

```typescript
// ✅ CORRECT
return res.status(200).json(success(chatResponse));

// ❌ WRONG
return res.status(200).json({ success: true, data: chatResponse });
```

---

### `*.types.ts` — Type Definitions

**Rule:** Interfaces, type aliases, and enums only. No runtime code.

```typescript
// src/lib/types/request.types.ts

import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  correlationId: string;
  requestId: string;
}
```

**Placement rules:**

| Scope | Location |
|-------|----------|
| Used by 2+ modules | `src/lib/types/` |
| Domain entity shape | `modules/<name>/domain/entities/` |
| Single route request/response | Top of `*.controller.ts` file |
| Zod-inferred types | Export from `*.schema.ts` via `z.infer<>` |

```typescript
// modules/chat/controllers/chat.controller.ts

// Route-specific types — defined here, NOT in lib/types/
interface SendMessageResponse {
  id: string;
  question: string;
  answer: string;
  tokenUsage: TokenUsage;
  quotaSource: 'FREE' | 'BUNDLE' | 'UNLIMITED';
}
```

---

### `*.schema.ts` — Zod Validation Schemas

**Rule:** Zod schemas for request validation. Co-located with the routes they validate.

```typescript
// modules/chat/controllers/chat.schema.ts

import { z } from 'zod';

export const sendMessageSchema = z.object({
  question: z.string().min(1).max(2000).trim(),
}).strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
```

| Rule | Detail |
|------|--------|
| Always use `.strict()` | Rejects unknown fields (prevents mass assignment) |
| Export inferred types | `export type X = z.infer<typeof xSchema>` |
| One schema per operation | `sendMessageSchema`, `createSubscriptionSchema` |
| Shared schemas | Only in `src/lib/` if used by 2+ modules |

---

### Other File Naming

| Pattern | Purpose | Example |
|---------|---------|---------|
| `*.entity.ts` | Domain entity with business rules | `subscription.entity.ts` |
| `*.service.ts` | Domain or infrastructure service | `quota.service.ts` |
| `*.policy.ts` | Authorization policy | `chat-access.policy.ts` |
| `*.repository.interface.ts` | Repository contract | `chat.repository.interface.ts` |
| `prisma-*.repository.ts` | Prisma repository implementation | `prisma-chat.repository.ts` |
| `*.use-case.ts` | Application use case | `send-message.use-case.ts` |
| `*.controller.ts` | HTTP route handler | `chat.controller.ts` |
| `*.middleware.ts` | Express middleware | `hmac.middleware.ts` |
| `*.config.ts` | Configuration module | `env.config.ts` |
| `*.helper.ts` | Test utilities | `auth.helper.ts` |

---

## Type Ownership

### The Single Source of Truth Principle

Every type has exactly one canonical definition. Import from that location — never duplicate.

```
┌─────────────────────────────────────────────────────────┐
│  Genuinely Shared (2+ modules)                          │
│  → src/lib/types/                                       │
│    request.types.ts, pagination.types.ts, error.types.ts│
├─────────────────────────────────────────────────────────┤
│  Domain Entity (single module)                          │
│  → modules/<name>/domain/entities/*.entity.ts             │
│    Subscription, ChatMessage, User                      │
├─────────────────────────────────────────────────────────┤
│  Route-Specific (single endpoint)                       │
│  → Top of modules/<name>/controllers/*.controller.ts  │
│    SendMessageResponse, CreateSubscriptionBody          │
├─────────────────────────────────────────────────────────┤
│  Validation-Derived (from Zod)                          │
│  → modules/<name>/controllers/*.schema.ts               │
│    SendMessageInput = z.infer<typeof sendMessageSchema> │
└─────────────────────────────────────────────────────────┘
```

### Decision Flowchart

```
Is this type used by more than one module?
├── YES → src/lib/types/
└── NO → Is it a domain entity?
    ├── YES → modules/<name>/domain/entities/
    └── NO → Is it derived from a Zod schema?
        ├── YES → Export from *.schema.ts
        └── NO → Define at top of *.controller.ts
```

### Examples

```typescript
// ✅ Shared — used by auth middleware, all controllers, logging
// src/lib/types/request.types.ts
export interface AuthenticatedUser { ... }

// ✅ Domain — only subscription module cares about internal state
// modules/subscriptions/domain/entities/subscription.entity.ts
export class Subscription { ... }

// ✅ Route-specific — only POST /api/chat uses this response shape
// modules/chat/controllers/chat.controller.ts (top of file)
interface SendMessageResponse { ... }

// ❌ WRONG — duplicating AuthenticatedUser in a controller
// modules/chat/controllers/chat.controller.ts
interface AuthenticatedUser { ... } // Import from @lib/types instead
```

---

## Module Boundaries

### `src/lib/` — Core/Generic Logic

Contains code that is **reusable across modules** and has **no domain-specific business rules**.

| Category | Examples |
|----------|---------|
| Configuration | `env.config.ts` |
| Logging | `logger.ts`, `logger.constants.ts` |
| Templates | `response.template.ts`, `error.template.ts` |
| Registries | `error-code.registry.ts`, `rate-limit.registry.ts` |
| Middleware | `hmac.middleware.ts`, `auth.middleware.ts` |
| Shared types | `request.types.ts`, `pagination.types.ts` |
| Pure constants | `http.constants.ts`, `quota.constants.ts` |

**Test:** If you removed all business modules, would this code still make sense? If yes → `lib/`.

### `src/modules/` — Domain-Specific Orchestration

Each module is a self-contained vertical slice for one bounded context.

| Module | Owns |
|--------|------|
| `auth/` | Users, passwords, JWT issuance, refresh tokens, mock OAuth |
| `chat/` | Messages, quota logic, mock AI |
| `subscriptions/` | Bundles, billing, renewals, payment simulation |

**Cross-module rules:**

| Allowed | Not Allowed |
|---------|-------------|
| Module A use case calls Module B's repository **interface** | Module A imports Module B's `infrastructure/` |
| Both modules import from `lib/` | Module A imports Module B's `controllers/` |
| Wiring in `app.ts` connects interfaces to implementations | Direct Prisma calls across modules |

### Dependency Direction (Summary)

```
controllers → application → domain ← infrastructure
     ↓              ↓           ↑           ↑
   lib/           lib/        lib/        lib/
```

**Business logic (domain layer) must NEVER import from controller or infrastructure layers.**

---

## Import Rules

### Path Aliases

Configured in `tsconfig.json`:

```json
{
  "paths": {
    "@lib/*": ["src/lib/*"],
    "@modules/*": ["src/modules/*"]
  }
}
```

### Import Order

```typescript
// 1. Node.js built-ins
import { createHmac } from 'crypto';

// 2. External packages
import { z } from 'zod';
import { Router } from 'express';

// 3. lib/ imports
import { success } from '@lib/responses/response.template';
import { createAppError } from '@lib/errors/error.template';

// 4. Same-module imports
import { QuotaService } from '../domain/services/quota.service';
import type { IChatRepository } from '../domain/repositories/chat.repository.interface';

// 5. Type-only imports (always use `import type`)
import type { AuthenticatedRequest } from '@lib/types/request.types';
```

### Forbidden Imports by Layer

| Layer | Forbidden Imports |
|-------|------------------|
| Domain | `express`, `@prisma/client`, any `infrastructure/`, any `controllers/` |
| Application | `express`, concrete `infrastructure/` implementations |
| Infrastructure | `controllers/`, `express` (except types if absolutely needed) |
| Controllers | Concrete `infrastructure/` (use use cases instead) |

---

## Code Style

### TypeScript

- **Strict mode** enabled (`strict: true` in `tsconfig.json`)
- Explicit return types on exported functions (ESLint warning)
- No `any` — use `unknown` and narrow (ESLint warning)
- Use `import type` for type-only imports
- Prefer `interface` for object shapes; `type` for unions and computed types
- Use `as const` for literal types
- Use `satisfies` for type-safe object literals without widening

### Functions

- Pure domain functions: no side effects, no I/O
- Use cases: single `execute()` method
- Controllers: thin — validate, call use case, return template response
- Max function length: ~40 lines; extract helpers if longer

### Classes

- Domain entities: classes with validation in constructor
- Domain services: classes or plain functions (consistent within module)
- Infrastructure: classes implementing repository interfaces
- No static mutable state

### Async

- Always `await` promises (ESLint `no-floating-promises`)
- Use `async/await`, not raw `.then()` chains
- Wrap repository calls in try/catch at use case level

---

## Error Handling Standards

### Always Use Error Registry + Template

```typescript
// ✅ CORRECT — in domain service or use case
throw createAppError('QUOTA_EXHAUSTED', { freeMessagesRemaining: 0 });

// ❌ WRONG — ad-hoc error
throw new Error('No quota left');

// ❌ WRONG — HTTP-specific error in domain
throw { status: 403, message: 'No quota' };
```

### Error Propagation

```
Domain Service  →  throws createAppError(code)
     ↓
Use Case        →  propagates (or catches and re-throws with context)
     ↓
Controller      →  passes to next(error)
     ↓
error-handler   →  maps AppError to HTTP response via registry
```

### Never

- Return error status codes from use cases
- Catch and swallow errors silently
- Include stack traces in production responses
- Log passwords, tokens, or HMAC secrets

---

## Logging Standards

### Always Use Structured Logger

```typescript
import { logger } from '@lib/logger/logger';

logger.info({
  event: 'QUOTA_DEDUCTED',
  correlationId: ctx.correlationId,
  requestId: ctx.requestId,
  userId: user.id,
  module: 'chat',
  metadata: { source: 'FREE', remaining: 2 },
});
```

### Never

```typescript
console.log('Quota deducted');     // ❌ Use logger
console.error(err);                // ❌ Use logger with event type
logger.info('User ' + email);       // ❌ Put email in metadata, not message string
```

---

## Directory Structure Reference

```
src/
├── lib/
│   ├── config/
│   │   └── env.config.ts
│   ├── constants/
│   │   ├── http.constants.ts          # *.constants.ts
│   │   ├── quota.constants.ts
│   │   └── time.constants.ts
│   ├── errors/
│   │   ├── error.template.ts          # *.template.ts
│   │   └── error-code.registry.ts     # *.registry.ts
│   ├── logger/
│   │   ├── logger.ts
│   │   └── logger.constants.ts
│   ├── middleware/
│   │   └── *.middleware.ts
│   ├── registries/
│   │   ├── rate-limit.registry.ts
│   │   ├── role.registry.ts
│   │   └── subscription-tier.registry.ts
│   ├── responses/
│   │   └── response.template.ts
│   └── types/
│       ├── request.types.ts           # *.types.ts (shared only)
│       ├── pagination.types.ts
│       └── error.types.ts
├── modules/
│   ├── auth/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── controllers/
│   │       ├── auth.controller.ts     # Route-specific types at top
│   │       └── auth.schema.ts         # *.schema.ts
│   ├── chat/
│   │   └── ... (same structure)
│   └── subscriptions/
│       └── ... (same structure)
├── app.ts
└── server.ts
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| `switch(tier) { case 'BASIC': return 10 }` | `getTierConfig(tier).maxMessages` from registry |
| `const ERROR_MSG = 'Not found'` in controller | `createAppError('NOT_FOUND')` from template |
| `interface LoginBody` in `lib/types/` | Define in `auth.controller.ts` (single route) |
| `import { PrismaClient }` in domain service | Use repository interface |
| `res.json({ error: 'bad' })` in controller | `next(createAppError('VALIDATION_ERROR'))` |
| Duplicate `USER_ROLE = 'USER'` in 3 files | `role.registry.ts` or `constants.ts` |
| `export function LIMIT() { return 3 }` in constants | `export const LIMIT = 3` in constants |
| Business logic in middleware | Middleware validates; use cases execute logic |
| God file with 500+ lines | Split by layer and responsibility |

---

## Related Documentation

- [Architecture](./architecture.md) — Layer rules and dependency flow
- [Registry Patterns](./registry-patterns.md) — When to use constants vs registries
- [Security](./security.md) — Validation and sanitization approach
- [Testing](./testing.md) — Test file organization

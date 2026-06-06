# Testing Strategy

This document describes the testing approach for the Secure Production-Grade Backend System, including unit tests, integration tests, test helpers, mocking strategy, and coverage targets.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [Test Helpers](#test-helpers)
6. [Mocking Approach](#mocking-approach)
7. [Coverage Targets](#coverage-targets)
8. [Running Tests](#running-tests)
9. [Writing New Tests](#writing-new-tests)
10. [CI Integration](#ci-integration)

---

## Testing Philosophy

| Principle | Implementation |
|-----------|---------------|
| Test behavior, not implementation | Assert outputs and side effects, not internal method calls |
| Domain logic is pure | Unit test without database or HTTP |
| No security bypasses | Auth and HMAC tested with real verification code |
| Same auth code in tests | Local JWT keypair used in both production and tests |
| Isolated test database | Each test suite gets a clean DB state |
| Fast unit tests | No I/O; run in milliseconds |
| Realistic integration tests | Full middleware stack + real PostgreSQL |

---

## Test Structure

```
tests/
├── unit/
│   ├── lib/
│   │   ├── error-code.registry.test.ts
│   │   ├── subscription-tier.registry.test.ts
│   │   ├── rate-limit.registry.test.ts
│   │   ├── role.registry.test.ts
│   │   ├── error.template.test.ts
│   │   ├── response.template.test.ts
│   │   └── env.config.test.ts
│   ├── chat/
│   │   ├── quota.service.test.ts
│   │   └── chat-access.policy.test.ts
│   ├── subscriptions/
│   │   ├── subscription.entity.test.ts
│   │   ├── billing.service.test.ts
│   │   ├── renewal.service.test.ts
│   │   └── subscription-access.policy.test.ts
│   └── auth/
│       ├── password.service.test.ts
│       └── token.service.test.ts
├── integration/
│   ├── middleware/
│   │   ├── auth.middleware.test.ts
│   │   ├── hmac.middleware.test.ts
│   │   ├── rate-limit.middleware.test.ts
│   │   ├── content-type.middleware.test.ts
│   │   └── validation.middleware.test.ts
│   ├── auth/
│   │   ├── register.test.ts
│   │   ├── login.test.ts
│   │   └── refresh.test.ts
│   ├── chat/
│   │   ├── send-message.test.ts
│   │   ├── chat-history.test.ts
│   │   └── quota-concurrency.test.ts
│   └── subscriptions/
│       ├── create-subscription.test.ts
│       ├── cancel-subscription.test.ts
│       └── renew-subscriptions.test.ts
└── helpers/
    ├── auth.helper.ts
    ├── db.helper.ts
    └── request.helper.ts
```

### Jest Configuration

```typescript
// jest.config.ts
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/**/*.types.ts',
    '!src/**/*.constants.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  clearMocks: true,
  restoreMocks: true,
}
```

Tests run **in band** (`--runInBand`) to avoid database race conditions in integration tests.

---

## Unit Tests

Unit tests verify pure logic in isolation — no database, no HTTP server, no external services.

### What to Unit Test

| Target | Location | What to Verify |
|--------|----------|---------------|
| Registries | `tests/unit/lib/*.registry.test.ts` | All keys return valid configs; derived helpers correct |
| Templates | `tests/unit/lib/*.template.test.ts` | Output shapes match `ApiResponse` / `AppError` interfaces |
| Domain services | `tests/unit/<module>/*.service.test.ts` | Business rules, edge cases, error throwing |
| Domain entities | `tests/unit/<module>/*.entity.test.ts` | Validation, state transitions, invariants |
| Domain policies | `tests/unit/<module>/*.policy.test.ts` | Access control for USER vs ADMIN, ownership checks |
| Config validation | `tests/unit/lib/env.config.test.ts` | Missing/invalid env vars fail fast |

### Unit Test Examples

#### Registry Test

```typescript
// tests/unit/lib/subscription-tier.registry.test.ts

import {
  getTierConfig,
  isUnlimited,
  getAllTiers,
} from '@lib/registries/subscription-tier.registry';

describe('subscription-tier.registry', () => {
  it('should return correct config for all tiers', () => {
    expect(getTierConfig('BASIC').maxMessages).toBe(10);
    expect(getTierConfig('PRO').maxMessages).toBe(100);
    expect(getTierConfig('ENTERPRISE').maxMessages).toBe(Infinity);
  });

  it('should identify unlimited tiers', () => {
    expect(isUnlimited('ENTERPRISE')).toBe(true);
    expect(isUnlimited('BASIC')).toBe(false);
    expect(isUnlimited('PRO')).toBe(false);
  });

  it('should list all tiers', () => {
    expect(getAllTiers()).toEqual(['BASIC', 'PRO', 'ENTERPRISE']);
  });
});
```

#### Domain Service Test

```typescript
// tests/unit/chat/quota.service.test.ts

import { QuotaService } from '@modules/chat/domain/services/quota.service';
import { createAppError } from '@lib/errors/error.template';

describe('QuotaService', () => {
  const quotaService = new QuotaService();

  describe('checkFreeQuota', () => {
    it('should allow message when free quota available', () => {
      const result = quotaService.checkFreeQuota({
        freeMessagesUsed: 1,
        freeQuotaResetDate: new Date('2026-06-01'),
        currentDate: new Date('2026-06-15'),
      });
      expect(result.available).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should reset free quota on new month', () => {
      const result = quotaService.checkFreeQuota({
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date('2026-05-01'),
        currentDate: new Date('2026-06-15'),
      });
      expect(result.available).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('should reject when free quota exhausted', () => {
      const result = quotaService.checkFreeQuota({
        freeMessagesUsed: 3,
        freeQuotaResetDate: new Date('2026-06-01'),
        currentDate: new Date('2026-06-15'),
      });
      expect(result.available).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('selectBundle', () => {
    it('should select bundle with latest remaining quota', () => {
      const bundles = [
        { id: 'a', remainingMessages: 5, tier: 'BASIC' as const },
        { id: 'b', remainingMessages: 50, tier: 'PRO' as const },
      ];
      const selected = quotaService.selectBundle(bundles);
      expect(selected?.id).toBe('b');
    });

    it('should return null when no bundles have quota', () => {
      const bundles = [
        { id: 'a', remainingMessages: 0, tier: 'BASIC' as const },
      ];
      expect(quotaService.selectBundle(bundles)).toBeNull();
    });

    it('should not deduct from enterprise (unlimited)', () => {
      const bundles = [
        { id: 'a', remainingMessages: 0, tier: 'ENTERPRISE' as const },
      ];
      const selected = quotaService.selectBundle(bundles);
      expect(selected?.id).toBe('a');
    });
  });
});
```

#### Template Test

```typescript
// tests/unit/lib/response.template.test.ts

import { success, paginated } from '@lib/responses/response.template';

describe('response.template', () => {
  it('should create success response', () => {
    const result = success({ id: '123' });
    expect(result).toEqual({
      success: true,
      data: { id: '123' },
      meta: null,
      error: null,
    });
  });

  it('should create paginated response', () => {
    const result = paginated(['a', 'b'], 10, 1, 2);
    expect(result.meta).toEqual({
      total: 10,
      page: 1,
      limit: 2,
      pages: 5,
    });
  });
});
```

#### Policy Test

```typescript
// tests/unit/chat/chat-access.policy.test.ts

import { ChatAccessPolicy } from '@modules/chat/domain/policies/chat-access.policy';

describe('ChatAccessPolicy', () => {
  const policy = new ChatAccessPolicy();

  it('should allow user to view own history', () => {
    expect(policy.canViewHistory(
      { id: 'user-1', role: 'USER', email: 'u@test.dev' },
      'user-1'
    )).toBe(true);
  });

  it('should deny user viewing another user history', () => {
    expect(policy.canViewHistory(
      { id: 'user-1', role: 'USER', email: 'u@test.dev' },
      'user-2'
    )).toBe(false);
  });

  it('should allow admin to view any history', () => {
    expect(policy.canViewHistory(
      { id: 'admin-1', role: 'ADMIN', email: 'a@test.dev' },
      'user-2'
    )).toBe(true);
  });
});
```

---

## Integration Tests

Integration tests verify the full HTTP request/response cycle through the real middleware stack and database.

### What to Integration Test

| Area | Tests | Verifies |
|------|-------|----------|
| Auth middleware | Valid/invalid/expired tokens | JWT verification, claim validation |
| HMAC middleware | Valid/invalid/missing signatures, clock skew | Request signing protocol |
| Rate limiting | Exceed limits, verify 429 | Per-IP and per-user limits |
| Content-Type | Non-JSON requests rejected | 415 response |
| Body size | Oversized payloads rejected | 413 response |
| Validation | Unknown fields rejected, invalid types | Zod `.strict()` behavior |
| Auth API | Register, login, refresh flows | Full auth lifecycle |
| Chat API | Send message, history, quota exhaustion | End-to-end chat with quota |
| Subscription API | Create, list, cancel, admin renew | Full subscription lifecycle |
| Concurrency | Parallel chat requests | Atomic quota deduction |
| Tracing | Correlation ID in response headers | Observability propagation |

### Integration Test Example

```typescript
// tests/integration/chat/send-message.test.ts

import { setupTestApp, teardownTestApp } from '../../helpers/db.helper';
import { createAuthenticatedClient } from '../../helpers/request.helper';
import type { TestApp } from '../../helpers/db.helper';

describe('POST /api/chat', () => {
  let app: TestApp;
  let client: ReturnType<typeof createAuthenticatedClient>;

  beforeAll(async () => {
    app = await setupTestApp();
    client = createAuthenticatedClient(app, { role: 'USER' });
  });

  afterAll(async () => {
    await teardownTestApp(app);
  });

  it('should send a message and return AI response', async () => {
    const response = await client
      .post('/api/chat')
      .send({ question: 'What is DDD?' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.answer).toBeDefined();
    expect(response.body.data.tokenUsage.totalTokens).toBeGreaterThan(0);
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('should return 403 when quota exhausted', async () => {
    // Exhaust free quota (3 messages)
    for (let i = 0; i < 3; i++) {
      await client.post('/api/chat').send({ question: `Question ${i}` });
    }

    const response = await client
      .post('/api/chat')
      .send({ question: 'One more' })
      .expect(403);

    expect(response.body.error.code).toBe('QUOTA_EXHAUSTED');
    expect(response.body.error.correlationId).toBeDefined();
  });

  it('should reject unknown fields', async () => {
    const response = await client
      .post('/api/chat')
      .send({ question: 'Hello', role: 'ADMIN' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject request without HMAC signature', async () => {
    const response = await client
      .post('/api/chat')
      .send({ question: 'Hello' })
      .set('X-Request-Signature', '')
      .expect(401);

    expect(response.body.error.code).toBe('HMAC_MISSING_SIGNATURE');
  });
});
```

### Rate Limiting Test

```typescript
// tests/integration/middleware/rate-limit.middleware.test.ts

describe('Rate limiting', () => {
  it('should return 429 after exceeding auth rate limit', async () => {
    const requests = Array.from({ length: 11 }, () =>
      client.post('/auth/login').send({ email: 'test@test.dev', password: 'wrong' })
    );

    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(r => r.status === 429);
    expect(tooManyRequests.length).toBeGreaterThanOrEqual(1);
  });
});
```

### Tracing Verification Test

```typescript
// tests/integration/middleware/tracing.test.ts

describe('Correlation ID tracing', () => {
  it('should echo client-provided correlation ID', async () => {
    const correlationId = 'test-correlation-id-12345';
    const response = await client
      .get('/api/chat/history')
      .set('X-Correlation-ID', correlationId)
      .expect(200);

    expect(response.headers['x-correlation-id']).toBe(correlationId);
  });

  it('should generate correlation ID when not provided', async () => {
    const response = await client
      .get('/api/chat/history')
      .expect(200);

    expect(response.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
```

---

## Test Helpers

### `auth.helper.ts` — Mint JWTs

Uses the **same local JWT code** as production. No external mock server needed.

```typescript
// tests/helpers/auth.helper.ts

import { SignJWT } from 'jose';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TokenOptions {
  userId?: string;
  email?: string;
  role?: 'USER' | 'ADMIN';
  expiresIn?: string;
}

let privateKey: CryptoKey;

async function loadPrivateKey(): Promise<CryptoKey> {
  if (!privateKey) {
    const pem = readFileSync(join(__dirname, '../../keys/private.pem'), 'utf8');
    privateKey = await importPKCS8(pem, 'RS256');
  }
  return privateKey;
}

export async function mintAccessToken(options: TokenOptions = {}): Promise<string> {
  const key = await loadPrivateKey();
  return new SignJWT({
    sub: options.userId ?? 'test-user-id',
    email: options.email ?? 'test@local.dev',
    role: options.role ?? 'USER',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(process.env.JWT_ISSUER ?? 'http://localhost:3000')
    .setAudience(process.env.JWT_AUDIENCE ?? 'local-api')
    .setExpirationTime(options.expiresIn ?? '15m')
    .sign(key);
}

export async function mintExpiredToken(): Promise<string> {
  return mintAccessToken({ expiresIn: '-1s' });
}
```

**Key principle:** Tests use the production `TokenService` and keypair. If JWT verification breaks in production, tests break too.

### `db.helper.ts` — Isolated Test Database

```typescript
// tests/helpers/db.helper.ts

import { PrismaClient } from '../../generated/prisma';
import { execSync } from 'child_process';

let prisma: PrismaClient;

export async function setupTestDb(): Promise<PrismaClient> {
  // Uses DATABASE_URL_TEST env var pointing to isolated test database
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
    ?? 'postgresql://postgres:postgres@localhost:5432/secure_backend_test';

  execSync('npx prisma migrate deploy', { stdio: 'pipe' });

  prisma = new PrismaClient();
  await prisma.$connect();

  // Clean all tables
  await prisma.$executeRaw`TRUNCATE TABLE "ChatMessage", "UsageLog", "PaymentLog", "Subscription", "RefreshToken", "User" CASCADE`;

  // Seed test users
  await seedTestUsers(prisma);

  return prisma;
}

export async function teardownTestDb(): Promise<void> {
  await prisma?.$disconnect();
}

export async function setupTestApp(): Promise<TestApp> {
  const prisma = await setupTestDb();
  const app = createApp(prisma); // Wire with test DB
  return { app, prisma };
}

export async function teardownTestApp(testApp: TestApp): Promise<void> {
  await teardownTestDb();
}
```

**Database isolation:**
- Test database: `secure_backend_test` (created by `scripts/init-test-db.sql` in Docker Compose)
- Each test suite truncates tables in `beforeAll` or `beforeEach`
- Migrations applied once per test run

### `request.helper.ts` — HMAC Signing + Auth

Wraps Supertest to auto-sign requests and attach auth tokens.

```typescript
// tests/helpers/request.helper.ts

import request, { Test } from 'supertest';
import { createHmac } from 'crypto';
import { mintAccessToken } from './auth.helper';
import type { Application } from 'express';

const HMAC_SECRET = process.env.HMAC_SECRET ?? 'test-hmac-secret';

function signRequest(method: string, path: string, body: string): {
  timestamp: string;
  signature: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return { timestamp, signature };
}

interface ClientOptions {
  role?: 'USER' | 'ADMIN';
  userId?: string;
  email?: string;
}

export function createAuthenticatedClient(app: Application, options: ClientOptions = {}) {
  let accessToken: string;

  beforeAll(async () => {
    accessToken = await mintAccessToken({
      role: options.role ?? 'USER',
      userId: options.userId,
      email: options.email,
    });
  });

  function authenticatedAgent(method: string, path: string) {
    const agent = request(app)[method.toLowerCase() as 'get' | 'post' | 'patch'](path);
    const body = '';
    const { timestamp, signature } = signRequest(method, path, body);

    return agent
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Request-Timestamp', timestamp)
      .set('X-Request-Signature', signature)
      .set('Content-Type', 'application/json');
  }

  return {
    get: (path: string) => authenticatedAgent('GET', path),
    post: (path: string) => authenticatedAgent('POST', path),
    patch: (path: string) => authenticatedAgent('PATCH', path),
  };
}

export function createPublicClient(app: Application) {
  return {
    get: (path: string) => {
      const { timestamp, signature } = signRequest('GET', path, '');
      return request(app)
        .get(path)
        .set('X-Request-Timestamp', timestamp)
        .set('X-Request-Signature', signature);
    },
    post: (path: string) => {
      const agent = request(app).post(path).set('Content-Type', 'application/json');
      return {
        send: (body: Record<string, unknown>) => {
          const bodyStr = JSON.stringify(body);
          const { timestamp, signature } = signRequest('POST', path, bodyStr);
          return agent
            .set('X-Request-Timestamp', timestamp)
            .set('X-Request-Signature', signature)
            .send(body);
        },
      };
    },
  };
}
```

**Usage:**

```typescript
// One-liner for authenticated requests
const client = createAuthenticatedClient(app, { role: 'ADMIN' });
const response = await client.post('/api/admin/subscriptions/renew').expect(200);
```

---

## Mocking Approach

### What Is Mocked

| Component | Mock Strategy | Why |
|-----------|--------------|-----|
| OpenAI API | `MockOpenAIService` with configurable latency | No external API key needed |
| Payment gateway | `MockPaymentGateway` with `PAYMENT_FAILURE_RATE` | Simulates billing locally |
| Google OAuth | `MockOAuthLoginUseCase` accepts any email | No OAuth app registration |
| Auth0 / external IdP | **Not used** — local JWT with `jose` | Zero external dependencies |

### What Is NOT Mocked

| Component | Approach | Why |
|-----------|----------|-----|
| JWT verification | Same `TokenService` + keypair as production | Tests must catch auth regressions |
| HMAC verification | Same `hmac.middleware.ts` as production | Security cannot be bypassed in tests |
| Rate limiting | Same `rate-limit.middleware.ts` | Verify real 429 behavior |
| Zod validation | Same schemas as production | Verify real rejection behavior |
| Prisma / PostgreSQL | Real test database | Verify real SQL, transactions, locking |
| Quota deduction | Real `QuotaService` + DB transactions | Verify atomic concurrency safety |

### No Auth Bypass

```typescript
// ❌ NEVER do this in tests
app.use((req, _res, next) => {
  req.user = { id: 'fake', role: 'ADMIN' }; // bypasses auth
  next();
});

// ✅ CORRECT — use real JWT
const token = await mintAccessToken({ role: 'ADMIN' });
await request(app)
  .get('/admin/metrics')
  .set('Authorization', `Bearer ${token}`)
  .set('X-Request-Timestamp', timestamp)
  .set('X-Request-Signature', signature)
  .expect(200);
```

---

## Coverage Targets

### Overall Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| Domain logic (services, entities, policies) | **80%+** | Core business rules must be thoroughly tested |
| Registries and templates | **90%+** | Small, critical, easy to achieve high coverage |
| Application (use cases) | **70%+** | Tested primarily via integration tests |
| Infrastructure (repositories) | **60%+** | Tested via integration tests with real DB |
| Controllers | **50%+** | Thin layer; covered by integration tests |
| `lib/` middleware | **70%+** | Security-critical; dedicated integration tests |

### Running Coverage

```bash
npm run test:coverage
```

Coverage report generated in `coverage/lcov-report/index.html`.

### Excluded from Coverage

| Pattern | Reason |
|---------|--------|
| `src/server.ts` | Entry point; no logic to test |
| `src/**/*.types.ts` | Type definitions only |
| `src/**/*.constants.ts` | Pure values; tested via consumers |

### Coverage Enforcement

The `jest.config.ts` can be extended with thresholds:

```typescript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 75,
    lines: 75,
    statements: 75,
  },
  './src/modules/*/domain/': {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage report
npm run test:coverage

# Single file
npx jest tests/unit/chat/quota.service.test.ts --runInBand

# Watch mode (development)
npx jest --watch --runInBand
```

### Prerequisites

```bash
# 1. Start PostgreSQL (includes test database)
docker compose up -d

# 2. Set test environment variables
export DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/secure_backend_test
export HMAC_SECRET=test-hmac-secret
export NODE_ENV=test

# 3. Run tests
npm test
```

---

## Writing New Tests

### Checklist for New Feature

```
□ Unit test for domain service/entity logic
□ Unit test for new registry entries (if applicable)
□ Integration test for new API endpoint(s)
□ Integration test for auth + HMAC on new endpoint
□ Integration test for validation rejection (unknown fields)
□ Test correlation ID propagation
□ Update coverage if new files added
```

### Test Naming Convention

```typescript
describe('<ComponentName>', () => {
  describe('<methodName>', () => {
    it('should <expected behavior> when <condition>', () => { ... });
    it('should throw <ERROR_CODE> when <condition>', () => { ... });
  });
});
```

### Test Data

- Use seed data from `db.helper.ts` for consistent baseline
- Generate UUIDs with `crypto.randomUUID()` for test-specific data
- Never hardcode production credentials
- Use `admin@local.dev` / `user@local.dev` from seed for role-based tests

---

## CI Integration

Recommended CI pipeline steps:

```yaml
steps:
  - name: Start PostgreSQL
    run: docker compose up -d

  - name: Install dependencies
    run: npm ci

  - name: Generate Prisma client
    run: npx prisma generate

  - name: Run migrations
    run: npx prisma migrate deploy
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/secure_backend_test

  - name: Lint
    run: npm run lint

  - name: Unit tests
    run: npm run test:unit

  - name: Integration tests
    run: npm run test:integration
    env:
      DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/secure_backend_test
      HMAC_SECRET: ci-test-hmac-secret
      NODE_ENV: test

  - name: Coverage
    run: npm run test:coverage
```

---

## Related Documentation

- [Architecture](./architecture.md) — Layer structure under test
- [Security](./security.md) — Auth and HMAC protocols tested
- [API Reference](./api-reference.md) — Endpoint contracts verified
- [Observability](./observability.md) — Tracing verification approach
- [Code Standards](./code-standards.md) — Test file naming conventions

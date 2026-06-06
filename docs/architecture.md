# Architecture

This document describes the system design for the Secure Production-Grade Backend System: a TypeScript REST API built with Domain-Driven Design (DDD) and Clean Architecture principles. The system runs entirely locally with no external service dependencies (PostgreSQL via Docker Compose is the only infrastructure dependency).

---

## Table of Contents

1. [Design Goals](#design-goals)
2. [Layer Model](#layer-model)
3. [Dependency Rules](#dependency-rules)
4. [Project Layout](#project-layout)
5. [Module Boundaries](#module-boundaries)
6. [Request Lifecycle](#request-lifecycle)
7. [Cross-Cutting Concerns](#cross-cutting-concerns)
8. [Data Flow Examples](#data-flow-examples)

---

## Design Goals

| Goal | How It Is Achieved |
|------|-------------------|
| Framework independence | Domain and application layers have zero Express/Prisma imports |
| Security-first | Every API route requires JWT + HMAC; no bypassable endpoints |
| Testability | Domain logic is pure; infrastructure is behind interfaces |
| Traceability | Correlation IDs propagate through logs, DB records, and responses |
| Local-first | Local JWT auth, mocked OpenAI, mocked payments — no cloud services |
| Type safety | Strict TypeScript, Zod validation, registry-driven lookups |

---

## Layer Model

The system follows Clean Architecture with four concentric layers. Dependencies always point **inward** — outer layers depend on inner layers, never the reverse.

### Textual Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTROLLERS (Delivery)                          │
│  Express routes, Zod schemas, route-local types, HTTP status mapping    │
│  Modules: auth/, chat/, subscriptions/                                  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION (Use Cases)                            │
│  Orchestrates domain services + repository interfaces                   │
│  send-message.use-case.ts, create-subscription.use-case.ts, etc.      │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOMAIN (Core)                                 │
│  Entities, domain services, policies, repository INTERFACES             │
│  quota.service.ts, billing.service.ts, chat-access.policy.ts            │
│  NO framework imports. NO infrastructure imports.                       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ implemented by
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE (Adapters)                          │
│  Prisma repositories, mock OpenAI, mock payment gateway, keypair store  │
│  prisma-chat.repository.ts, mock-openai.service.ts                      │
└─────────────────────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────────┐
         │              src/lib/ (Shared Kernel)            │
         │  Logger, config, templates, registries,          │
         │  middleware factories, shared types              │
         │  Used by all layers EXCEPT domain entities       │
         └──────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Domain Layer (`modules/<name>/domain/`)

The innermost layer. Contains pure business logic.

| Sub-folder | Responsibility | Examples |
|------------|----------------|----------|
| `entities/` | Domain objects with identity and lifecycle rules | `chat-message.entity.ts`, `subscription.entity.ts`, `user.entity.ts` |
| `services/` | Stateless domain operations spanning entities | `quota.service.ts`, `billing.service.ts`, `token.service.ts` |
| `policies/` | Authorization rules enforced inside use cases | `chat-access.policy.ts`, `subscription-access.policy.ts` |
| `repositories/` | **Interfaces only** — contracts for persistence | `chat.repository.interface.ts` |

**Hard rule:** Domain code must **never** import from:
- `controllers/`
- `infrastructure/`
- Express, Prisma, Winston, or any I/O library

Domain services may import from `src/lib/` only for:
- Pure constants (`quota.constants.ts`)
- Registry accessors (`subscription-tier.registry.ts`)
- Shared error types (not HTTP-specific)

#### Application Layer (`modules/<name>/application/`)

Thin orchestration layer. Each use case represents one user intention.

```
Controller → UseCase.execute(input) → Domain Service → Repository Interface
```

Examples:
- `send-message.use-case.ts` — quota check → mock AI → persist message
- `create-subscription.use-case.ts` — validate tier → calculate dates → persist
- `register.use-case.ts` — hash password → create user → issue tokens

Use cases:
- Receive typed input DTOs (not raw `req.body`)
- Call domain services and repository interfaces
- Emit structured log events via `src/lib/logger`
- Throw domain errors via `createAppError()` from `error.template.ts`
- Return typed output DTOs

Use cases must **not** contain HTTP logic (`res.status`, headers, etc.).

#### Infrastructure Layer (`modules/<name>/infrastructure/`)

Implements domain repository interfaces and external service adapters.

| Sub-folder | Responsibility | Examples |
|------------|----------------|----------|
| `repositories/` | Prisma implementations of domain interfaces | `prisma-chat.repository.ts` |
| `services/` | External service mocks/adapters | `mock-openai.service.ts`, `local-keypair.service.ts` |

Infrastructure may import Prisma, `jose`, `bcrypt`, and `src/lib/`. It must **not** import controllers.

#### Controllers Layer (`modules/<name>/controllers/`)

The HTTP delivery mechanism. Translates HTTP to use case input and use case output to HTTP.

| File | Responsibility |
|------|----------------|
| `*.controller.ts` | Route definitions, middleware attachment, response mapping |
| `*.schema.ts` | Zod validation schemas for this module's routes |
| Route-local types | Request/response interfaces defined at top of controller file |

Controllers:
- Parse and validate input via `validate.middleware.ts` + Zod schemas
- Call use cases
- Map results through `success()` / `paginated()` from `response.template.ts`
- Map errors through centralized `error-handler.middleware.ts`
- Apply `rbac.middleware.ts` for role checks

---

## Dependency Rules

### The Dependency Rule (Always Inward)

```
Controllers  →  Application  →  Domain  ←  Infrastructure
     ↓              ↓              ↑            ↑
   lib/           lib/          lib/         lib/
```

| From | May Import | Must NOT Import |
|------|-----------|-----------------|
| Domain | Other domain files, `lib/constants`, `lib/registries` (accessors only) | Controllers, infrastructure, Express, Prisma |
| Application | Domain, repository interfaces, `lib/` | Controllers, concrete infrastructure |
| Infrastructure | Domain interfaces, Prisma, external libs, `lib/` | Controllers |
| Controllers | Application use cases, `lib/`, Zod schemas | Concrete infrastructure (inject via DI/wiring in `app.ts`) |
| `lib/` | Other `lib/` files, standard libraries | Module-specific domain code |

### Dependency Injection / Wiring

Concrete implementations are wired at the application boundary in `src/app.ts`:

```typescript
// Pseudocode — wiring happens once at startup
const chatRepository = new PrismaChatRepository(prisma);
const quotaService = new QuotaService();
const sendMessageUseCase = new SendMessageUseCase(chatRepository, quotaService, mockOpenAI);
const chatController = new ChatController(sendMessageUseCase);
```

Controllers and use cases depend on **interfaces**, not concrete classes. Wiring is the only place where concrete infrastructure classes are instantiated.

### Forbidden Import Examples

```typescript
// ❌ NEVER in domain/services/quota.service.ts
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { prismaChatRepository } from '../../infrastructure/repositories/prisma-chat.repository';

// ✅ CORRECT in domain/services/quota.service.ts
import { FREE_MONTHLY_LIMIT } from '@lib/constants/quota.constants';
import { isUnlimited, getTierConfig } from '@lib/registries/subscription-tier.registry';
```

---

## Project Layout

```
src/
├── lib/                          # Core/generic reusable logic
│   ├── config/
│   ├── logger/
│   ├── errors/
│   ├── responses/
│   ├── middleware/
│   ├── registries/
│   ├── types/
│   └── constants/
├── modules/
│   ├── auth/                     # Authentication & user management
│   ├── chat/                     # AI chat & quota management
│   └── subscriptions/            # Subscription bundles & billing
├── app.ts                        # Express app + middleware stack
└── server.ts                     # Entry point, graceful shutdown

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

tests/
├── unit/
├── integration/
└── helpers/
```

### `src/lib/` — Shared Kernel

Houses **generic, cross-cutting** logic that is not tied to a single business domain:

- Configuration validation (`env.config.ts`)
- Structured logging (`logger.ts`)
- Response/error templates (`response.template.ts`, `error.template.ts`)
- Middleware factories (HMAC, rate-limit, validation, error handler)
- Registries (error codes, rate limits, subscription tiers, roles)
- Shared types (`AuthenticatedRequest`, `RequestContext`, pagination)
- Pure constants (HTTP status codes, header names, time tolerances)

**Rule:** If logic is used by two or more modules and contains no domain-specific business rules, it belongs in `lib/`.

### `src/modules/` — Domain Modules

Each module is a **vertical slice** containing all layers for one bounded context:

| Module | Bounded Context | Key Use Cases |
|--------|----------------|---------------|
| `auth/` | Identity & access | Register, login, refresh, mock OAuth |
| `chat/` | AI messaging & quotas | Send message, get history |
| `subscriptions/` | Billing & bundles | Create, list, cancel, admin renew |

Modules must not import from each other's `infrastructure/` or `controllers/` layers. Cross-module communication goes through:
- Shared `lib/` utilities
- Application use cases calling another module's repository interface (wired in `app.ts`)
- Domain events (future extension point)

---

## Module Boundaries

### Auth Module (`modules/auth/`)

```
auth/
├── domain/
│   ├── entities/          user.entity.ts, refresh-token.entity.ts
│   ├── services/          token.service.ts, password.service.ts
│   └── repositories/      user.repository.interface.ts, refresh-token.repository.interface.ts
├── application/
│   └── use-cases/         register, login, refresh-token, mock-oauth-login
├── infrastructure/
│   ├── repositories/      prisma-user.repository.ts, prisma-refresh-token.repository.ts
│   └── services/          local-keypair.service.ts
└── controllers/
    ├── auth.controller.ts
    └── auth.schema.ts
```

Owns: user identity, password hashing, JWT issuance/verification, refresh token rotation.

### Chat Module (`modules/chat/`)

```
chat/
├── domain/
│   ├── entities/          chat-message.entity.ts
│   ├── services/          quota.service.ts
│   ├── policies/          chat-access.policy.ts
│   └── repositories/      chat.repository.interface.ts
├── application/
│   └── use-cases/         send-message.use-case.ts
├── infrastructure/
│   ├── repositories/      prisma-chat.repository.ts
│   └── services/          mock-openai.service.ts
└── controllers/
    ├── chat.controller.ts
    └── chat.schema.ts
```

Owns: message storage, quota deduction logic, mock AI responses.

### Subscriptions Module (`modules/subscriptions/`)

```
subscriptions/
├── domain/
│   ├── entities/          subscription.entity.ts
│   ├── services/          billing.service.ts, renewal.service.ts
│   ├── policies/          subscription-access.policy.ts
│   └── repositories/      subscription.repository.interface.ts
├── application/
│   └── use-cases/         create, cancel, renew-subscriptions
├── infrastructure/
│   ├── repositories/      prisma-subscription.repository.ts
│   └── services/          mock-payment-gateway.service.ts
└── controllers/
    ├── subscription.controller.ts
    └── subscription.schema.ts
```

Owns: subscription lifecycle, billing simulation, renewal scheduling.

---

## Request Lifecycle

A typical authenticated API request flows through the system as follows:

```
HTTP Request
    │
    ▼
[Middleware Stack]  ← src/lib/middleware/ (see security.md for order)
    │
    ▼
[Controller]        ← Parse route params, call use case
    │
    ▼
[Use Case]          ← Orchestrate domain + repositories
    │
    ├──► [Domain Service]    ← Business rules (quota, billing)
    ├──► [Domain Policy]     ← Authorization (ownership, role)
    └──► [Repository Interface]
              │
              ▼
         [Prisma Repository]  ← Database I/O
    │
    ▼
[Response Template]  ← success() / createAppError()
    │
    ▼
HTTP Response (JSON envelope + X-Correlation-ID header)
```

---

## Cross-Cutting Concerns

| Concern | Location | Used By |
|---------|----------|---------|
| Error handling | `lib/errors/error.template.ts`, `error-code.registry.ts` | All layers |
| Logging | `lib/logger/logger.ts` | All layers except pure entities |
| Validation | `lib/middleware/validate.middleware.ts` + per-route `*.schema.ts` | Controllers |
| Auth | `lib/middleware/auth.middleware.ts` + `modules/auth/` | All protected routes |
| Rate limiting | `lib/middleware/rate-limit.middleware.ts` + `rate-limit.registry.ts` | Route groups |

---

## Data Flow Examples

### Example 1: Send Chat Message

```
POST /api/chat { question: "Hello" }
  │
  ├─ auth.middleware      → verify JWT, attach req.user
  ├─ hmac.middleware      → verify request signature
  ├─ validate.middleware  → parse { question } via chat.schema.ts
  │
  ├─ chat.controller      → SendMessageUseCase.execute({ userId, question, correlationId })
  │     │
  │     ├─ QuotaService.checkAndDeduct()     [DOMAIN — no DB imports]
  │     │     └─ throws QUOTA_EXHAUSTED if no quota
  │     │
  │     ├─ ChatAccessPolicy.canSend()        [DOMAIN]
  │     │
  │     ├─ MockOpenAIService.generate()      [INFRASTRUCTURE]
  │     │
  │     └─ IChatRepository.save()            [INTERFACE → Prisma impl]
  │
  └─ response.template.success({ answer, tokenUsage })
```

### Example 2: Create Subscription

```
POST /api/subscriptions { tier, billingCycle, autoRenew }
  │
  ├─ auth.middleware + hmac.middleware + validate.middleware
  │
  ├─ subscription.controller → CreateSubscriptionUseCase.execute()
  │     │
  │     ├─ getTierConfig(tier)               [REGISTRY in lib/]
  │     ├─ Subscription entity validation    [DOMAIN]
  │     ├─ SubscriptionAccessPolicy          [DOMAIN]
  │     └─ ISubscriptionRepository.create()  [INFRASTRUCTURE]
  │
  └─ response.template.success({ subscription })
```

---

## Technology Stack Summary

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 22+ | Modern LTS, native fetch, performance |
| Language | TypeScript (strict) | Type safety across all layers |
| HTTP | Express 5 | Minimal coupling; domain stays pure |
| Database | PostgreSQL 16 + Prisma | Relational model, `$transaction()` for atomic quota |
| Auth | Local JWT (`jose`, RS256) | Zero external deps; mimics OIDC |
| Validation | Zod | Schema-first, strips unknown fields |
| Logging | Winston (JSON) | Structured, machine-parseable |
| Testing | Jest + Supertest | Unit + integration in one runner |

---

## Related Documentation

- [Security Model](./security.md) — Threat model, auth flow, middleware order
- [API Reference](./api-reference.md) — All endpoints with request/response shapes
- [Code Standards](./code-standards.md) — File naming, type ownership
- [Registry Patterns](./registry-patterns.md) — Lookup tables and accessor functions
- [Observability](./observability.md) — Logging, tracing, metrics
- [Testing](./testing.md) — Test strategy and coverage targets

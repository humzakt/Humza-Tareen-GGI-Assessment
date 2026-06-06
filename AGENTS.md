# Agent Context

This file provides context for AI coding agents (Claude, Codex, Cursor, Copilot, etc.) working on this codebase.

## Project Overview

A production-grade TypeScript backend using Express 5, PostgreSQL (Prisma 7), and Clean Architecture / DDD patterns. Two main domain modules:

1. **AI Chat** (`src/modules/chat/`) - Secured chat endpoint with mocked OpenAI, monthly quota tracking (3 free + subscription bundles), atomic deduction via DB transactions.
2. **Subscriptions** (`src/modules/subscriptions/`) - Subscription lifecycle (Basic/Pro/Enterprise), billing simulation with random failures, auto-renewal, cancellation.

Authentication uses local RS256 JWTs (via `jose`) mimicking OAuth2/OIDC with JWKS endpoint. HMAC request signing is required as an additional security layer.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (hot reload, port 3000) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run all 76 tests (unit + integration) |
| `npm run test:unit` | 55 unit tests only |
| `npm run test:integration` | 21 integration tests only |
| `npm run lint` | ESLint check |
| `npm run setup` | Full first-time setup (install + migrate + seed) |
| `npx tsc --noEmit` | Type-check without emitting |

## Architecture

```
src/lib/         → Generic utilities (config, logger, middleware, registries, templates, types)
src/modules/     → Domain modules, each with: domain/ → application/ → infrastructure/ → controllers/
src/routes/      → Health check & admin metrics
tests/unit/      → Domain logic tests (no DB)
tests/integration/ → API tests with mocked Prisma
```

### Layer Rules

- **Domain** (`domain/entities`, `domain/services`, `domain/policies`) — Pure business logic, zero framework imports
- **Application** (`application/use-cases`) — Orchestrates domain objects, depends on repository interfaces
- **Infrastructure** (`infrastructure/`) — Implements repository interfaces with Prisma, external service mocks
- **Controllers** — Express routes, Zod validation, wires use cases

## Key Patterns

- **Registry pattern**: `src/lib/registries/` — Error codes, subscription tiers, roles, rate limits. Single source of truth.
- **Template pattern**: `src/lib/responses/` and `src/lib/errors/` — Factories for consistent API response shapes.
- **HMAC signing**: Every protected request needs `x-request-timestamp` + `x-request-signature` headers.
- **Prisma 7 adapter**: Uses `@prisma/adapter-pg` with `connectionString`. No `datasourceUrl` in PrismaClient constructor.

## File Conventions

| Suffix | Purpose |
|--------|---------|
| `.constants.ts` | Pure constant values |
| `.registry.ts` | Typed lookup tables with helper functions |
| `.template.ts` | Factory functions for structured outputs |
| `.schema.ts` | Zod validation schemas (body schemas use `.strict()`) |
| `.entity.ts` | Domain entities |
| `.service.ts` | Domain or infrastructure services |
| `.policy.ts` | Authorization policies |
| `.use-case.ts` | Application-layer orchestrators |
| `.repository.interface.ts` | Repository contracts (in domain) |

## Testing Notes

- Auth is mocked in `tests/helpers/setup.ts` with a deterministic keypair
- Use `getAuthHeaders(userId, role)` from `tests/helpers/auth.helper.ts` to generate test JWTs + HMAC
- Prisma is mocked via `jest.mock()` — no real DB needed for tests
- Integration tests use `supertest` against the Express `app` directly

## Environment

Requires `.env` file (see `.env.example`). Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ISSUER`, `JWT_AUDIENCE` — Token validation
- `HMAC_SECRET` — Request signing key
- `CORS_ORIGIN` — Allowed origin

## Database

PostgreSQL 16. Docker Compose provided (`docker-compose.yml`). Models: User, RefreshToken, ChatMessage, Subscription, UsageLog, PaymentLog. Migrations in `prisma/migrations/`.

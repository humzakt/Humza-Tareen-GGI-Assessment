# CLAUDE.md — Project Instructions for Claude Code / Codex

## Quick Start

```bash
npm run setup    # Install deps, generate Prisma, run migrations, seed DB
npm run dev      # Dev server on :3000
npm test         # All tests (76 total)
npx tsc --noEmit # Type check
```

## What This Is

Production-grade TypeScript backend with:
- **AI Chat Module** — Mocked OpenAI, quota management (3 free/month + subscription bundles)
- **Subscription Module** — CRUD, billing simulation, auto-renewal
- **Auth** — Local RS256 JWT + HMAC request signing (no external providers)
- **Security** — Helmet, CORS, rate limiting, content-type validation, timeout

## Architecture

Clean Architecture / DDD with strict layer separation:

```
src/lib/              # Shared: config, logger, middleware, registries, types, templates
src/modules/auth/     # JWT issuance, login/register, keypair management
src/modules/chat/     # Chat domain (entities, quota service, access policy, use cases)
src/modules/subscriptions/  # Subscription domain (billing, renewal, policies)
```

Each module follows: `domain/ → application/ → infrastructure/ → controllers/`

Domain layer is **pure** — no Express, no Prisma, no framework imports.

## Critical Rules

1. **Errors**: Always use `createAppError('ERROR_CODE')` — codes defined in `src/lib/registries/error-code.registry.ts`
2. **Responses**: Use `success(data)` or `paginated(items, total, page, limit)` templates
3. **Validation**: Zod schemas with `.strict()` on request bodies
4. **DB**: All mutations in `prisma.$transaction()` for atomicity
5. **Logging**: `logger.info(LOG_EVENTS.X, { module: LOG_MODULES.Y, correlationId, requestId }, metadata)`
6. **Prisma 7**: Uses `@prisma/adapter-pg` — pass `connectionString` to adapter, NOT `datasourceUrl` to PrismaClient
7. **Tests**: Auth mocked via deterministic keypair in `tests/helpers/setup.ts`

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/registries/error-code.registry.ts` | All error codes, HTTP statuses, messages |
| `src/lib/registries/subscription-tier.registry.ts` | Tier configs (price, maxMessages) |
| `src/lib/registries/role.registry.ts` | RBAC roles and permissions |
| `src/lib/registries/rate-limit.registry.ts` | Rate limit configs per route group |
| `src/lib/prisma/client.ts` | Prisma singleton with pg adapter |
| `src/modules/chat/domain/services/quota.service.ts` | Quota checking logic |
| `src/modules/subscriptions/domain/services/billing.service.ts` | Payment simulation |
| `prisma/schema.prisma` | Database schema |
| `tests/helpers/auth.helper.ts` | Test JWT/HMAC generation |

## Environment

Requires `.env` (copy from `.env.example`). PostgreSQL must be running on the configured `DATABASE_URL`.

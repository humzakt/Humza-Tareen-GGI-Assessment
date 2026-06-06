# Copilot Instructions

## Project

TypeScript backend (Express 5, Prisma 7, PostgreSQL) using Clean Architecture / DDD.

## Conventions

- Strict TypeScript — no `any`, use `unknown` and narrow
- Domain layer has zero framework imports (no Express, no Prisma)
- All errors use `createAppError('CODE')` from `src/lib/errors/error.template.ts`
- All responses use `success()` or `paginated()` from `src/lib/responses/response.template.ts`
- Zod body schemas must call `.strict()` to reject extra fields
- DB mutations must be wrapped in `prisma.$transaction()`
- Log with structured logger: `logger.info(LOG_EVENTS.EVENT_NAME, { module, correlationId, requestId }, metadata)`

## File naming

- Constants: `.constants.ts`
- Registries (lookup tables): `.registry.ts`
- Zod schemas: `.schema.ts` (co-located with controllers)
- Domain entities: `.entity.ts`
- Use cases: `.use-case.ts`
- Repository interfaces: `.repository.interface.ts`

## Testing

- Unit tests: mock Prisma, test domain logic in isolation
- Integration tests: use supertest, mock auth via `tests/helpers/setup.ts`
- Generate auth headers with `getAuthHeaders()` from `tests/helpers/auth.helper.ts`

## Architecture

`src/lib/` = shared utilities | `src/modules/<name>/domain/` = business logic | `src/modules/<name>/application/` = use cases | `src/modules/<name>/infrastructure/` = Prisma repos & mocks | `src/modules/<name>/controllers/` = routes

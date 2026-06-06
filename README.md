# Secure Production-Grade Backend System

A fully local, zero-external-dependency TypeScript backend implementing **Domain-Driven Design (DDD)**, **Clean Architecture**, and production-grade security patterns.

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                  Controllers                        │
│  (Express routes, input validation, response)      │
├────────────────────────────────────────────────────┤
│               Application Layer                     │
│  (Use cases, orchestration, transaction mgmt)      │
├────────────────────────────────────────────────────┤
│                Domain Layer                         │
│  (Entities, services, policies, repo interfaces)   │
├────────────────────────────────────────────────────┤
│             Infrastructure Layer                    │
│  (Prisma repositories, mock services, keypair)     │
└────────────────────────────────────────────────────┘
```

Dependencies flow **inward only**. Domain logic has zero framework dependencies.

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22+ / TypeScript 5.x (strict mode) |
| Framework | Express.js |
| Database | PostgreSQL 16 (via Docker Compose) |
| ORM | Prisma 7 |
| Auth | Local JWT (RS256 via `jose`) - mimics OAuth2/OIDC |
| Validation | Zod |
| Testing | Jest + Supertest |
| Security | Helmet, express-rate-limit, HMAC request signing |
| Logging | Winston (structured JSON) |
| Code Quality | ESLint + Prettier |

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
npm install

# 3. Run migrations and seed
npx prisma migrate dev
npx prisma db seed

# 4. Start the server (generates RS256 keypair on first run)
npm run dev
```

Server ready at `http://localhost:3000`.

**Pre-seeded users:**
- Admin: `admin@local.dev` / `admin123`
- User: `user@local.dev` / `user123`

## Zero External Dependencies

- **No Auth0/Clerk** — Local JWT issuer with RS256 keypair (auto-generated)
- **No OpenAI** — Fully mocked with configurable latency (200-800ms)
- **No Payment Gateway** — Simulated with configurable failure rate
- **No Redis** — In-memory rate limiting
- **PostgreSQL** — Single `docker compose up -d`

## Modules

### Authentication (`/auth`)
- `POST /auth/register` — Email/password registration
- `POST /auth/login` — Email/password login
- `POST /auth/refresh` — Token refresh (rotation)
- `GET /auth/oauth/google/callback?email=...` — Mocked Google OAuth

### AI Chat (`/api/chat`)
- `POST /api/chat` — Send a question, receive mocked AI response
- `GET /api/chat/history` — Paginated chat history

**Quota System:**
- 3 free messages per calendar month (auto-resets on 1st)
- After free quota: uses subscription bundles (BASIC: 10, PRO: 100, ENTERPRISE: unlimited)
- Atomic deduction via PostgreSQL transactions with row-level locking

### Subscriptions (`/api/subscriptions`)
- `POST /api/subscriptions` — Create subscription (BASIC/PRO/ENTERPRISE, MONTHLY/YEARLY)
- `GET /api/subscriptions` — List user's subscriptions
- `PATCH /api/subscriptions/:id/cancel` — Cancel (stops auto-renew, preserves history)
- `POST /api/subscriptions/renew` — Trigger renewal check (admin only)

### Observability
- `GET /health` — Database connectivity, uptime, version
- `GET /admin/metrics` — Admin-only: usage stats, subscription counts, payment success rate

## Security Model

### Multi-Layer Protection
1. **JWT Authentication** — RS256 signed, validates issuer/audience/expiry
2. **HMAC Request Signing** — Timestamp + signature prevents replay attacks
3. **Role-Based Access Control** — Controller-level + domain policy-level enforcement
4. **Rate Limiting** — Per-IP (auth: 10/15min) and per-user (chat: 30/min)
5. **Input Validation** — Zod schemas, strict mode (rejects unknown fields)
6. **Security Headers** — Helmet (CSP, HSTS, X-Frame-Options, etc.)
7. **CORS** — Strict origin whitelist
8. **Body Size Limit** — 10kb max
9. **Request Timeout** — 30s global

### Making Authenticated Requests

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@local.dev","password":"user123"}' | jq -r '.data.accessToken')

# 2. Generate HMAC signature
TIMESTAMP=$(date +%s%3N)
BODY='{"question":"What is DDD?"}'
SIGNATURE=$(echo -n "${TIMESTAMP}POST/api/chat${BODY}" | openssl dgst -sha256 -hmac "local-dev-hmac-secret-change-in-production" | cut -d' ' -f2)

# 3. Call protected endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-timestamp: $TIMESTAMP" \
  -H "x-request-signature: $SIGNATURE" \
  -d "$BODY"
```

## Testing

```bash
# All tests (76 tests, 10 suites)
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage report
npm run test:coverage
```

**Test Coverage:**
- Unit tests: Domain logic, registries, templates, quota calculation, subscription lifecycle
- Integration tests: Auth, HMAC, rate limiting, RBAC, content-type validation, correlation IDs

## Project Structure

```
src/
  lib/                    # Core/generic utilities
    config/               # Environment validation (Zod)
    constants/            # Pure values (http, quota, time)
    errors/               # Error factory (createAppError)
    logger/               # Winston structured logging
    middleware/           # All Express middleware
    registries/           # Typed lookup tables
    responses/            # Response factory (success, paginated)
    types/                # Shared types
  modules/
    auth/                 # Authentication module (DDD layers)
    chat/                 # AI Chat module (DDD layers)
    subscriptions/        # Subscription module (DDD layers)
  app.ts                  # Express app (middleware stack)
  server.ts               # Entry point
docs/                     # Comprehensive documentation
tests/                    # Unit + integration tests
```

## Documentation

Detailed documentation is available in the `docs/` folder:

- [Architecture](docs/architecture.md) — Layer rules, dependency flow, module boundaries
- [Security](docs/security.md) — Threat model, JWT flow, HMAC protocol, RBAC matrix
- [API Reference](docs/api-reference.md) — All endpoints with examples
- [Code Standards](docs/code-standards.md) — Naming conventions, type ownership
- [Registry Patterns](docs/registry-patterns.md) — When to use constants vs registries
- [Observability](docs/observability.md) — Logging format, correlation IDs, metrics
- [Testing](docs/testing.md) — Strategy, helpers, coverage targets

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled production build |
| `npm test` | Run all tests |
| `npm run lint` | Check ESLint |
| `npm run format` | Format with Prettier |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed database |
| `npm run prisma:studio` | Open Prisma Studio GUI |

## Environment Variables

See `.env.example` for all configuration options. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection | Docker Compose DB |
| `PORT` | 3000 | Server port |
| `JWT_ISSUER` | http://localhost:3000 | Token issuer claim |
| `JWT_AUDIENCE` | local-api | Token audience claim |
| `HMAC_SECRET` | (dev default) | Request signing secret |
| `PAYMENT_FAILURE_RATE` | 0.2 | Simulated payment failure probability |
| `LOG_LEVEL` | info | Winston log level |

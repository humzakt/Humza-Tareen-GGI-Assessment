# Security Model

This document describes the security architecture of the Secure Production-Grade Backend System. The design follows a **defense-in-depth** strategy: no single mechanism is trusted alone. Every protected endpoint requires **both** a valid JWT access token **and** a valid HMAC request signature.

All security mechanisms run locally — no external identity providers, no cloud WAF, no third-party secrets managers.

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Threat Model](#threat-model)
3. [Authentication: Local JWT (RS256)](#authentication-local-jwt-rs256)
4. [Request Signing: HMAC Protocol](#request-signing-hmac-protocol)
5. [Authorization: RBAC Matrix](#authorization-rbac-matrix)
6. [Middleware Stack](#middleware-stack)
7. [Rate Limiting Strategy](#rate-limiting-strategy)
8. [Input Validation & Sanitization](#input-validation--sanitization)
9. [HTTP Hardening](#http-hardening)
10. [Secrets Management](#secrets-management)
11. [Security Event Logging](#security-event-logging)

---

## Security Principles

1. **No open endpoints** — Every route except `/health`, `/.well-known/jwks.json`, and auth registration/login requires authentication + HMAC signing.
2. **Token possession is insufficient** — A stolen JWT alone cannot call APIs; the attacker also needs the HMAC secret and signing algorithm.
3. **Fail closed** — Any validation failure returns an error immediately; there is no degraded or anonymous fallback for protected routes.
4. **Defense in depth** — Multiple independent layers (headers, CORS, rate limits, JWT, HMAC, RBAC, domain policies) must all pass.
5. **Least privilege** — Users access only their own resources; admins have explicit system-wide permissions defined in a registry.
6. **Audit everything** — All auth successes, failures, and security events are logged with correlation IDs.

---

## Threat Model

### Assets

| Asset | Sensitivity | Storage |
|-------|-------------|---------|
| User credentials (password hashes) | High | PostgreSQL (`User.passwordHash`) |
| JWT private key (RS256) | Critical | `keys/private.pem` (gitignored) |
| HMAC shared secret | Critical | Environment variable / auto-generated |
| Refresh tokens | High | PostgreSQL (hashed), HTTP-only flow |
| Chat messages & subscription data | Medium | PostgreSQL |
| Admin metrics | Medium | Computed at runtime |

### Threat Actors

| Actor | Capability | Goal |
|-------|-----------|------|
| Anonymous external attacker | Network access to API | Unauthorized data access, DoS |
| Authenticated user | Valid JWT + HMAC secret | Access other users' data (IDOR) |
| Compromised client | Stolen JWT | Replay requests, exhaust quota |
| Malicious input | Crafted HTTP payloads | Injection, XSS, mass assignment |

### Threat Matrix

| Threat | Attack Vector | Mitigation |
|--------|--------------|------------|
| **Brute-force login** | Repeated `POST /auth/login` | Per-IP rate limit (10/15min on auth routes), bcrypt cost factor |
| **Credential stuffing** | Stolen password lists | bcrypt hashing, account lockout via rate limiting |
| **JWT theft / replay** | Intercepted Bearer token | Short access token TTL (15m), HMAC signing required, timestamp validation |
| **Token forgery** | Crafted JWT with fake claims | RS256 signature verification against local public key |
| **IDOR** | Access `/api/chat/history` with another user's token | Domain policies enforce `resource.userId === req.user.id`; RBAC at controller |
| **SQL injection** | Malicious input in query params/body | Prisma parameterized queries, Zod input validation |
| **XSS (stored/reflected)** | Script tags in `question` field | Input sanitization, `Content-Type: application/json` only, Helmet CSP headers |
| **Mass assignment** | Extra fields in JSON body (`{ "role": "ADMIN" }`) | Zod `.strict()` schemas reject unknown fields |
| **DoS (volume)** | High request rate | Per-IP and per-user rate limiting |
| **DoS (payload)** | Large request bodies | `express.json({ limit: '10kb' })` |
| **DoS (slow)** | Slow-loris / long-running requests | 30-second global request timeout |
| **CSRF** | Cross-origin form submission | Strict CORS whitelist, JSON-only content type |
| **Clickjacking** | Embedded iframe | Helmet `X-Frame-Options: DENY` |
| **MITM** | Network interception | HTTPS recommended in production; HMAC prevents tampering |
| **Clock skew replay** | Old signed request replayed | `X-Request-Timestamp` validated within 5-minute window |
| **Privilege escalation** | User calls admin endpoint | RBAC middleware + domain policy double-check |
| **Information leakage** | Verbose error messages | Structured errors via registry; no stack traces in production |

---

## Authentication: Local JWT (RS256)

The system implements a **local OAuth2/OIDC-compatible** authentication flow. No external identity provider is used. The `jose` library handles RS256 signing and verification.

### Keypair Lifecycle

```
First server start
    │
    ▼
local-keypair.service.ts
    │
    ├─ keys/private.pem exists? ──No──► Generate RS256 keypair
    │                                      Save to keys/ (gitignored)
    └─ Yes ──► Load existing keypair
    │
    ▼
Expose public key via GET /.well-known/jwks.json
```

| File | Purpose |
|------|---------|
| `keys/private.pem` | Signs JWTs (never exposed) |
| `keys/public.pem` | Verifies JWTs, published via JWKS |
| `GET /.well-known/jwks.json` | OIDC-compatible public key discovery |

### Auth Endpoints (No JWT Required)

These endpoints require HMAC signing but **not** a Bearer token:

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/register` | Create account, return tokens |
| `POST /auth/login` | Authenticate, return tokens |
| `POST /auth/refresh` | Exchange refresh token for new access token |
| `GET /auth/oauth/google/callback` | Mocked Google OAuth (creates/links user) |

### Token Structure

Access and refresh tokens are JWTs with OIDC-compatible claims:

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@local.dev",
  "role": "USER",
  "iss": "http://localhost:3000",
  "aud": "local-api",
  "iat": 1717670400,
  "exp": 1717671300
}
```

| Claim | Value | Validated By |
|-------|-------|-------------|
| `sub` | User UUID | `auth.middleware.ts` |
| `email` | User email | Attached to `req.user` |
| `role` | `USER` or `ADMIN` | RBAC middleware + domain policies |
| `iss` | `JWT_ISSUER` env (default: `http://localhost:3000`) | Signature verification |
| `aud` | `JWT_AUDIENCE` env (default: `local-api`) | Signature verification |
| `exp` | Unix timestamp | Rejected if expired |

### Token TTL

| Token | Default TTL | Env Variable |
|-------|------------|--------------|
| Access token | 15 minutes | `JWT_ACCESS_EXPIRY` |
| Refresh token | 7 days | `JWT_REFRESH_EXPIRY` |

Refresh tokens are stored hashed in the database (`RefreshToken` model) and can be revoked.

### JWT Verification Flow

```
Incoming request with Authorization: Bearer <token>
    │
    ▼
auth.middleware.ts
    │
    ├─ Extract Bearer token from Authorization header
    ├─ Missing? → 401 AUTH_MISSING_TOKEN
    │
    ├─ Verify RS256 signature against local public key
    ├─ Invalid signature? → 401 AUTH_INVALID_TOKEN
    │
    ├─ Validate iss claim === JWT_ISSUER
    ├─ Validate aud claim === JWT_AUDIENCE
    ├─ Validate exp claim (not expired)
    ├─ Claim mismatch? → 401 AUTH_INVALID_TOKEN
    │
    ├─ Load user from DB by sub (userId)
    ├─ User not found? → 401 AUTH_USER_NOT_FOUND
    │
    ├─ Attach user to req.user (id, email, role)
    └─ Log AUTH_SUCCESS
```

### Password Security

- Hashing: **bcrypt** with default cost factor (10 rounds)
- Plaintext passwords are never stored or logged
- Registration validates minimum password length via Zod schema

### Mock OAuth Flow

`GET /auth/oauth/google/callback?email=<email>&name=<name>` simulates a Google OAuth redirect:

1. Accepts any email (no real Google verification)
2. Creates user if not exists (`authProvider: GOOGLE_MOCK`)
3. Issues access + refresh tokens
4. Useful for local testing without OAuth app registration

---

## Request Signing: HMAC Protocol

JWT verification alone is insufficient. Clients must also sign every request with a shared secret.

### Required Headers

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <access_token>` (protected routes only) |
| `X-Request-Timestamp` | Unix timestamp in **seconds** (e.g., `1717670400`) |
| `X-Request-Signature` | Hex-encoded HMAC-SHA256 signature |
| `X-Correlation-ID` | Optional client-provided UUID; auto-generated if absent |

### Signature Construction

```
payload = timestamp + method + path + body

signature = HMAC-SHA256(payload, HMAC_SECRET)
```

| Component | Rule | Example |
|-----------|------|---------|
| `timestamp` | Raw string from `X-Request-Timestamp` header | `"1717670400"` |
| `method` | Uppercase HTTP method | `"POST"` |
| `path` | URL path including query string | `"/api/chat"` or `"/auth/oauth/google/callback?email=test@local.dev"` |
| `body` | Raw request body string; empty string `""` for GET/DELETE with no body | `'{"question":"Hello"}'` |

### Client Signing Example (Node.js)

```typescript
import { createHmac } from 'crypto';

function signRequest(
  method: string,
  path: string,
  body: string,
  secret: string
): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { timestamp, signature };
}

// Usage
const body = JSON.stringify({ question: 'What is DDD?' });
const { timestamp, signature } = signRequest('POST', '/api/chat', body, process.env.HMAC_SECRET!);

// Headers:
// X-Request-Timestamp: <timestamp>
// X-Request-Signature: <signature>
// Authorization: Bearer <access_token>
```

### Server Verification Flow

```
hmac.middleware.ts
    │
    ├─ Read X-Request-Timestamp
    ├─ Missing? → 401 HMAC_MISSING_TIMESTAMP
    │
    ├─ Parse as integer, compare to server time
    ├─ |serverTime - timestamp| > HMAC_TOLERANCE_MS (5 min)? → 401 HMAC_TIMESTAMP_EXPIRED
    │
    ├─ Read X-Request-Signature
    ├─ Missing? → 401 HMAC_MISSING_SIGNATURE
    │
    ├─ Reconstruct payload: timestamp + method + path + rawBody
    ├─ Compute expected = HMAC-SHA256(payload, HMAC_SECRET)
    ├─ Constant-time compare expected vs provided
    ├─ Mismatch? → 401 INVALID_SIGNATURE
    │
    └─ Log HMAC_VERIFIED
```

### Routes Exempt from HMAC

| Route | Reason |
|-------|--------|
| `GET /health` | Load balancer health probe |
| `GET /.well-known/jwks.json` | Public key discovery (OIDC standard) |

All other routes, including auth endpoints, require HMAC signing.

---

## Authorization: RBAC Matrix

Authorization is enforced at **two levels**:

1. **Controller level** — `rbac.middleware.ts` checks role before the route handler runs
2. **Domain policy level** — Policy classes verify resource ownership inside use cases

### Roles

| Role | Description |
|------|-------------|
| `USER` | Standard authenticated user; access own resources only |
| `ADMIN` | System administrator; system-wide read and admin operations |

### Permission Matrix

| Resource / Action | USER | ADMIN |
|-------------------|------|-------|
| `POST /auth/register` | Public (no role) | Public |
| `POST /auth/login` | Public | Public |
| `POST /auth/refresh` | Public (refresh token) | Public |
| `GET /auth/oauth/google/callback` | Public | Public |
| `POST /api/chat` | Own quota only | Own quota only |
| `GET /api/chat/history` | Own messages only | All messages |
| `POST /api/subscriptions` | Own subscriptions | Own subscriptions |
| `GET /api/subscriptions` | Own subscriptions | All subscriptions |
| `PATCH /api/subscriptions/:id/cancel` | Own subscription only | Any subscription |
| `POST /api/admin/subscriptions/renew` | Denied (403) | Allowed |
| `GET /health` | Public (no auth) | Public |
| `GET /admin/metrics` | Denied (403) | Allowed |
| `GET /.well-known/jwks.json` | Public | Public |

### Domain Policy Enforcement

```typescript
// chat-access.policy.ts
class ChatAccessPolicy {
  canViewHistory(user: User, targetUserId: string): boolean {
    if (user.role === 'ADMIN') return true;
    return user.id === targetUserId;
  }

  canCancelSubscription(user: User, subscription: Subscription): boolean {
    if (user.role === 'ADMIN') return true;
    return subscription.userId === user.id;
  }
}
```

Policies are called **inside use cases**, not just at the controller boundary. This prevents bypass if a use case is called from a new route in the future.

### Role Registry

Allowed roles per route group are defined in `src/lib/registries/role.registry.ts`:

```typescript
const ROUTE_ROLES = {
  'admin:metrics': ['ADMIN'],
  'admin:subscriptions:renew': ['ADMIN'],
  'api:chat': ['USER', 'ADMIN'],
  'api:subscriptions': ['USER', 'ADMIN'],
} as const satisfies Record<RouteGroup, Role[]>;
```

---

## Middleware Stack

Middleware order is **critical**. Each layer depends on context established by earlier layers.

```
Order │ Middleware                    │ Why This Position
──────┼───────────────────────────────┼──────────────────────────────────────────
  1   │ Helmet                        │ Set security headers before any response
  2   │ CORS                          │ Reject disallowed origins early
  3   │ express.json({ limit: 10kb }) │ Parse body before content-type check
  4   │ content-type.middleware       │ Reject non-JSON before business logic
  5   │ timeout.middleware (30s)      │ Start timeout clock after body parsed
  6   │ request-context.middleware    │ Inject requestId, correlationId, startTime
  7   │ request lifecycle log (START) │ Log after context is available
  8   │ rate-limit.middleware         │ Throttle before expensive auth crypto
  9   │ auth.middleware (JWT)         │ Establish identity before HMAC (needs user for per-user limits)
 10   │ hmac.middleware               │ Verify request integrity
 11   │ validate.middleware (Zod)     │ Validate parsed body against schema
 12   │ rbac.middleware               │ Check role permissions for route
 13   │ Route handler                 │ Execute use case
 14   │ request lifecycle log (END)   │ Log duration, status code
 15   │ error-handler.middleware      │ Catch-all; must be last
```

### Why Auth Before HMAC?

Per-user rate limiting (step 8) may need `req.user.id` for authenticated routes. Auth middleware runs before rate limiters on user-scoped route groups. On auth routes (login/register), per-IP limiting applies before any identity is established.

### Why Validation After HMAC?

HMAC signs the raw body. Validation must operate on the same parsed body that was signed. The body parser (step 3) preserves the raw body buffer for HMAC verification before Zod strips/transforms fields.

---

## Rate Limiting Strategy

Rate limiting uses `express-rate-limit` with configuration driven by `rate-limit.registry.ts`. Stores are in-memory (sufficient for single-instance local deployment).

### Route Group Limits

| Route Group | Scope | Window | Max Requests | Key |
|-------------|-------|--------|-------------|-----|
| `auth` | Per-IP | 15 minutes | 10 | Client IP address |
| `chat` | Per-user | 1 minute | 30 | `req.user.id` |
| `subscriptions` | Per-user | 1 minute | 20 | `req.user.id` |
| `global` | Per-IP | 15 minutes | 100 | Client IP address (fallback) |

### Rate Limit Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

HTTP Status: **429 Too Many Requests**

Response headers:
- `Retry-After: <seconds>`
- `X-RateLimit-Limit: <max>`
- `X-RateLimit-Remaining: 0`

### Implementation Notes

- Auth routes use IP-based keys because no user identity exists yet
- Chat and subscription routes use user ID keys to prevent one user from exhausting another's quota via shared IP
- Global fallback catches unclassified routes
- Rate limit hits log `RATE_LIMIT_HIT` with IP/userId and route group

---

## Input Validation & Sanitization

### Schema-Based Validation (Zod)

Every route has a co-located `*.schema.ts` file:

```typescript
// chat.schema.ts
import { z } from 'zod';

export const sendMessageSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(2000, 'Question must be at most 2000 characters')
    .trim(),
}).strict(); // Rejects unknown fields
```

### Validation Middleware Behavior

```
validate.middleware.ts
    │
    ├─ Run Zod schema.safeParse(req.body)
    ├─ Failure? → 400 VALIDATION_ERROR with field-level details
    ├─ Success? → Replace req.body with parsed (trimmed/coerced) data
    └─ Continue to next middleware
```

### Sanitization Rules

| Attack | Prevention |
|--------|-----------|
| XSS | `.trim()` on strings; JSON-only content type; Helmet CSP |
| SQL injection | Prisma parameterized queries; no raw SQL with user input |
| NoSQL injection | N/A (PostgreSQL only) |
| Mass assignment | `.strict()` on all Zod schemas — unknown fields rejected |
| Type confusion | Zod enforces types; no implicit coercion except explicit `.coerce` |
| Prototype pollution | Zod parsing creates plain objects; no `__proto__` merging |
| Oversized input | Zod `.max()` on strings; 10kb body limit at parser level |

### Validation Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "details": {
      "fields": [
        { "path": "question", "message": "Question is required" }
      ]
    }
  }
}
```

HTTP Status: **400 Bad Request**

---

## HTTP Hardening

### Helmet Configuration

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Restrictive default | Prevent XSS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Strict-Transport-Security` | Enabled in production | Force HTTPS |
| `X-XSS-Protection` | `0` | Disabled (CSP is preferred) |

### CORS

- Allowed origins: `CORS_ORIGIN` env variable (default: `http://localhost:3000`)
- Methods: `GET`, `POST`, `PATCH`, `DELETE`
- Allowed headers: `Authorization`, `Content-Type`, `X-Request-Timestamp`, `X-Request-Signature`, `X-Correlation-ID`
- Credentials: `true` (for cookie-based flows if added later)

### Request Size Limits

- JSON body: **10 KB** maximum (`express.json({ limit: '10kb' })`)
- Exceeding limit: **413 Payload Too Large**, logs `OVERSIZED_BODY`

### Request Timeout

- Global timeout: **30 seconds**
- On timeout: **408 Request Timeout**, logs `TIMEOUT`

---

## Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| RS256 private key | `keys/private.pem` (gitignored) | Delete `keys/` and restart server |
| HMAC secret | `HMAC_SECRET` env var | Update env and restart; auto-generated in dev if missing |
| Database password | `DATABASE_URL` env var | Update Docker Compose / env |
| JWT issuer/audience | Env vars | Update env and re-issue tokens |

**Never commit:**
- `keys/` directory
- `.env` files
- Any file containing `HMAC_SECRET` or database credentials

---

## Security Event Logging

All security events are logged as structured JSON (see [Observability](./observability.md)):

| Event | Level | When |
|-------|-------|------|
| `AUTH_SUCCESS` | info | JWT verified, user attached |
| `AUTH_FAILURE` | warn | Invalid/expired/missing token |
| `HMAC_VERIFIED` | debug | Signature valid |
| `HMAC_REJECTED` | warn | Invalid/missing signature or timestamp |
| `RATE_LIMIT_HIT` | warn | Client exceeded rate limit |
| `RBAC_DENIED` | warn | User role insufficient for route |
| `INVALID_CONTENT_TYPE` | warn | Non-JSON request body |
| `OVERSIZED_BODY` | warn | Body exceeds 10kb |
| `TIMEOUT` | warn | Request exceeded 30s |
| `VALIDATION_ERROR` | info | Zod schema rejection |

---

## Related Documentation

- [Architecture](./architecture.md) — Layer rules and module boundaries
- [API Reference](./api-reference.md) — Endpoint details and error codes
- [Observability](./observability.md) — Log format and correlation IDs
- [Testing](./testing.md) — Security integration test approach

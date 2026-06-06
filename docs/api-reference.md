# API Reference

Complete reference for all HTTP endpoints exposed by the Secure Production-Grade Backend System.

**Base URL:** `http://localhost:3000` (configurable via `PORT` env variable)

---

## Table of Contents

1. [Conventions](#conventions)
2. [Response Envelope](#response-envelope)
3. [Required Headers](#required-headers)
4. [Error Codes](#error-codes)
5. [Authentication Endpoints](#authentication-endpoints)
6. [Chat Endpoints](#chat-endpoints)
7. [Subscription Endpoints](#subscription-endpoints)
8. [Admin Endpoints](#admin-endpoints)
9. [System Endpoints](#system-endpoints)
10. [Public Endpoints](#public-endpoints)

---

## Conventions

| Convention | Value |
|------------|-------|
| Content-Type | `application/json` (required for all requests with a body) |
| Authentication | `Authorization: Bearer <access_token>` |
| Request signing | `X-Request-Timestamp` + `X-Request-Signature` (HMAC-SHA256) |
| Correlation | `X-Correlation-ID` (optional; UUID v4 generated if omitted) |
| Timestamps | ISO 8601 in responses; Unix seconds in `X-Request-Timestamp` |
| IDs | UUID v4 strings |

---

## Response Envelope

All endpoints return a consistent JSON envelope:

### Success Response

```json
{
  "success": true,
  "data": { },
  "meta": null,
  "error": null
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "details": {}
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  },
  "error": null
}
```

### Response Headers (All Endpoints)

| Header | Description |
|--------|-------------|
| `X-Correlation-ID` | Correlation ID for this request (echoed or generated) |
| `X-Request-ID` | Internal request ID (UUID) |
| `Content-Type` | `application/json` |

---

## Required Headers

### Protected Endpoints

| Header | Required | Example |
|--------|----------|---------|
| `Authorization` | Yes | `Bearer eyJhbGciOiJSUzI1NiIs...` |
| `Content-Type` | Yes (if body) | `application/json` |
| `X-Request-Timestamp` | Yes | `1717670400` |
| `X-Request-Signature` | Yes | `a3f2b1c0d9e8f7a6b5c4d3e2f1a0b9c8...` |
| `X-Correlation-ID` | No | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |

### Public Endpoints (`/health`, `/.well-known/jwks.json`)

No headers required.

### Auth Endpoints (`/auth/*`)

| Header | Required |
|--------|----------|
| `Content-Type` | Yes (if body) |
| `X-Request-Timestamp` | Yes |
| `X-Request-Signature` | Yes |
| `Authorization` | No |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body failed Zod schema validation |
| `AUTH_MISSING_TOKEN` | 401 | No Bearer token provided on protected route |
| `AUTH_INVALID_TOKEN` | 401 | JWT signature, issuer, audience, or expiry invalid |
| `AUTH_USER_NOT_FOUND` | 401 | Token valid but user no longer exists |
| `AUTH_INVALID_CREDENTIALS` | 401 | Email/password login failed |
| `AUTH_EMAIL_EXISTS` | 409 | Registration email already registered |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid, expired, or revoked |
| `HMAC_MISSING_TIMESTAMP` | 401 | `X-Request-Timestamp` header absent |
| `HMAC_MISSING_SIGNATURE` | 401 | `X-Request-Signature` header absent |
| `HMAC_TIMESTAMP_EXPIRED` | 401 | Timestamp outside 5-minute tolerance window |
| `INVALID_SIGNATURE` | 401 | HMAC signature does not match |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `QUOTA_EXHAUSTED` | 403 | No free quota or subscription messages remaining |
| `SUBSCRIPTION_INACTIVE` | 403 | Subscription is inactive |
| `SUBSCRIPTION_NOT_FOUND` | 404 | Subscription ID does not exist |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds 10 KB |
| `REQUEST_TIMEOUT` | 408 | Request exceeded 30-second timeout |
| `INVALID_CONTENT_TYPE` | 415 | Content-Type is not `application/json` |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Authentication Endpoints

### POST /auth/register

Create a new user account with email and password.

**Authentication:** HMAC only (no Bearer token)

**Rate limit:** 10 requests / 15 min per IP

#### Request Body

```json
{
  "email": "newuser@local.dev",
  "password": "securePass123",
  "name": "New User"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Min 8 characters |
| `name` | string | Yes | Min 1, max 100 characters |

#### Success Response — 201 Created

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "newuser@local.dev",
      "name": "New User",
      "role": "USER",
      "authProvider": "LOCAL",
      "createdAt": "2026-06-06T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  },
  "meta": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid email, short password, missing fields |
| 409 | `AUTH_EMAIL_EXISTS` | Email already registered |
| 401 | `INVALID_SIGNATURE` | HMAC verification failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many registration attempts |

---

### POST /auth/login

Authenticate with email and password.

**Authentication:** HMAC only

**Rate limit:** 10 requests / 15 min per IP

#### Request Body

```json
{
  "email": "user@local.dev",
  "password": "user123"
}
```

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "email": "user@local.dev",
      "name": "Test User",
      "role": "USER",
      "authProvider": "LOCAL"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  },
  "meta": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing email or password |
| 401 | `AUTH_INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `INVALID_SIGNATURE` | HMAC verification failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many login attempts |

---

### POST /auth/refresh

Exchange a refresh token for a new access token.

**Authentication:** HMAC only

**Rate limit:** 10 requests / 15 min per IP

#### Request Body

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required |
|-------|------|----------|
| `refreshToken` | string | Yes |

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  },
  "meta": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing refreshToken |
| 401 | `AUTH_INVALID_REFRESH_TOKEN` | Token invalid, expired, or revoked |
| 401 | `INVALID_SIGNATURE` | HMAC verification failed |

---

### GET /auth/oauth/google/callback

Mocked Google OAuth callback. Creates or links a user by email and returns tokens.

**Authentication:** HMAC only

**Rate limit:** 10 requests / 15 min per IP

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Email address (simulates Google account) |
| `name` | string | No | Display name (defaults to email local part) |

#### Example Request

```
GET /auth/oauth/google/callback?email=google.user@local.dev&name=Google%20User
```

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "email": "google.user@local.dev",
      "name": "Google User",
      "role": "USER",
      "authProvider": "GOOGLE_MOCK"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  },
  "meta": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing or invalid email |
| 401 | `INVALID_SIGNATURE` | HMAC verification failed |

---

## Chat Endpoints

### POST /api/chat

Send a question to the mocked AI and receive a response. Deducts from free quota or subscription bundle.

**Authentication:** Bearer token + HMAC

**Authorization:** `USER` or `ADMIN` role

**Rate limit:** 30 requests / min per user

#### Request Body

```json
{
  "question": "What is Domain-Driven Design?"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `question` | string | Yes | Min 1, max 2000 characters |

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "question": "What is Domain-Driven Design?",
    "answer": "Domain-Driven Design (DDD) is a software design approach that focuses on modeling software to match a domain according to input from that domain's experts.",
    "tokenUsage": {
      "promptTokens": 12,
      "completionTokens": 45,
      "totalTokens": 57
    },
    "quotaSource": "FREE",
    "remainingQuota": {
      "freeMessages": 2,
      "subscriptionMessages": 10
    },
    "createdAt": "2026-06-06T10:05:00.000Z"
  },
  "meta": null,
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `quotaSource` | `"FREE"` \| `"BUNDLE"` \| `"UNLIMITED"` | Which quota was deducted |
| `remainingQuota.freeMessages` | number | Free messages left this month |
| `remainingQuota.subscriptionMessages` | number | Total remaining across active bundles |

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Empty or oversized question |
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 401 | `INVALID_SIGNATURE` | HMAC verification failed |
| 403 | `QUOTA_EXHAUSTED` | No free or subscription quota remaining |
| 429 | `RATE_LIMIT_EXCEEDED` | Chat rate limit exceeded |

#### Quota Exhausted Error Example — 403

```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "QUOTA_EXHAUSTED",
    "message": "Monthly quota exhausted. Purchase a subscription bundle.",
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "details": {
      "freeMessagesRemaining": 0,
      "activeSubscriptions": 0
    }
  }
}
```

---

### GET /api/chat/history

Retrieve chat message history for the authenticated user. Admins can view all users' history.

**Authentication:** Bearer token + HMAC

**Authorization:** `USER` (own history) or `ADMIN` (all history)

**Rate limit:** 30 requests / min per user

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 20 | Items per page (max 100) |
| `userId` | string (UUID) | No | — | Admin only: filter by user ID |

#### Example Request

```
GET /api/chat/history?page=1&limit=10
```

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "userId": "660e8400-e29b-41d4-a716-446655440001",
      "question": "What is Domain-Driven Design?",
      "answer": "Domain-Driven Design (DDD) is a software design approach...",
      "tokenUsage": {
        "promptTokens": 12,
        "completionTokens": 45,
        "totalTokens": 57
      },
      "createdAt": "2026-06-06T10:05:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "pages": 1
  },
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 403 | `FORBIDDEN` | User attempting to view another user's history |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |

---

## Subscription Endpoints

### POST /api/subscriptions

Create a new subscription bundle.

**Authentication:** Bearer token + HMAC

**Authorization:** `USER` or `ADMIN` role

**Rate limit:** 20 requests / min per user

#### Request Body

```json
{
  "tier": "PRO",
  "billingCycle": "MONTHLY",
  "autoRenew": true
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `tier` | string | Yes | `BASIC`, `PRO`, `ENTERPRISE` |
| `billingCycle` | string | Yes | `MONTHLY`, `YEARLY` |
| `autoRenew` | boolean | Yes | `true` or `false` |

#### Tier Configuration

| Tier | Max Messages | Price (Monthly) |
|------|-------------|-----------------|
| `BASIC` | 10 | $9.99 |
| `PRO` | 100 | $29.99 |
| `ENTERPRISE` | Unlimited | $99.99 |

Yearly billing applies a discount (price × 10 for 12 months).

#### Success Response — 201 Created

```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "tier": "PRO",
    "billingCycle": "MONTHLY",
    "maxMessages": 100,
    "remainingMessages": 100,
    "price": 29.99,
    "startDate": "2026-06-06T10:00:00.000Z",
    "endDate": "2026-07-06T10:00:00.000Z",
    "renewalDate": "2026-07-06T10:00:00.000Z",
    "autoRenew": true,
    "active": true,
    "createdAt": "2026-06-06T10:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid tier, billing cycle, or unknown fields |
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |

---

### GET /api/subscriptions

List subscriptions for the authenticated user. Admins see all subscriptions.

**Authentication:** Bearer token + HMAC

**Authorization:** `USER` or `ADMIN` role

**Rate limit:** 20 requests / min per user

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page |
| `active` | boolean | No | — | Filter by active status |
| `userId` | string (UUID) | No | — | Admin only: filter by user |

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "userId": "660e8400-e29b-41d4-a716-446655440001",
      "tier": "PRO",
      "billingCycle": "MONTHLY",
      "maxMessages": 100,
      "remainingMessages": 95,
      "price": 29.99,
      "startDate": "2026-06-06T10:00:00.000Z",
      "endDate": "2026-07-06T10:00:00.000Z",
      "renewalDate": "2026-07-06T10:00:00.000Z",
      "autoRenew": true,
      "active": true,
      "createdAt": "2026-06-06T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  },
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |

---

### PATCH /api/subscriptions/:id/cancel

Cancel a subscription. Ends the current billing cycle, disables auto-renewal, preserves historical data.

**Authentication:** Bearer token + HMAC

**Authorization:** Owner or `ADMIN`

**Rate limit:** 20 requests / min per user

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription ID |

#### Request Body

No body required. Send `{}` or omit body.

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "tier": "PRO",
    "billingCycle": "MONTHLY",
    "maxMessages": 100,
    "remainingMessages": 95,
    "price": 29.99,
    "startDate": "2026-06-06T10:00:00.000Z",
    "endDate": "2026-07-06T10:00:00.000Z",
    "renewalDate": "2026-07-06T10:00:00.000Z",
    "autoRenew": false,
    "active": true,
    "cancelledAt": "2026-06-06T11:00:00.000Z",
    "createdAt": "2026-06-06T10:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

> **Note:** Subscription remains `active: true` until `endDate`. It will not renew after cancellation.

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 403 | `FORBIDDEN` | User does not own this subscription |
| 403 | `SUBSCRIPTION_INACTIVE` | Subscription already inactive |
| 404 | `SUBSCRIPTION_NOT_FOUND` | Subscription ID not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |

---

## Admin Endpoints

### POST /api/admin/subscriptions/renew

Trigger a renewal check for all subscriptions due for renewal. Simulates payment processing.

**Authentication:** Bearer token + HMAC

**Authorization:** `ADMIN` only

**Rate limit:** Global per-IP fallback

#### Request Body

No body required.

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "processed": 5,
    "renewed": 4,
    "failed": 1,
    "results": [
      {
        "subscriptionId": "990e8400-e29b-41d4-a716-446655440004",
        "userId": "660e8400-e29b-41d4-a716-446655440001",
        "status": "RENEWED",
        "newEndDate": "2026-08-06T10:00:00.000Z"
      },
      {
        "subscriptionId": "aa0e8400-e29b-41d4-a716-446655440005",
        "userId": "660e8400-e29b-41d4-a716-446655440001",
        "status": "PAYMENT_FAILED",
        "reason": "Simulated payment failure"
      }
    ]
  },
  "meta": null,
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 403 | `FORBIDDEN` | User is not ADMIN |

---

### GET /admin/metrics

Retrieve system-wide metrics and analytics.

**Authentication:** Bearer token + HMAC

**Authorization:** `ADMIN` only

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "uptime": 86400,
    "version": "1.0.0",
    "users": {
      "total": 150,
      "activeLast24h": 42
    },
    "messages": {
      "total": 1250,
      "last24h": 87,
      "avgTokenUsage": 52
    },
    "subscriptions": {
      "total": 200,
      "active": 145,
      "byTier": {
        "BASIC": 80,
        "PRO": 55,
        "ENTERPRISE": 10
      }
    },
    "quota": {
      "freeMessagesUsed": 320,
      "bundleMessagesUsed": 890
    },
    "errors": {
      "last24h": 12,
      "rateLimitHits": 5
    }
  },
  "meta": {
    "generatedAt": "2026-06-06T12:00:00.000Z"
  },
  "error": null
}
```

#### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 401 | `AUTH_INVALID_TOKEN` | Invalid or expired JWT |
| 403 | `FORBIDDEN` | User is not ADMIN |

---

## System Endpoints

### GET /health

Health check endpoint for load balancers and monitoring.

**Authentication:** None

**HMAC:** Not required

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "version": "1.0.0",
    "timestamp": "2026-06-06T12:00:00.000Z",
    "checks": {
      "database": {
        "status": "up",
        "responseTimeMs": 3
      }
    }
  },
  "meta": null,
  "error": null
}
```

#### Degraded Response — 503 Service Unavailable

```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "uptime": 86400,
    "version": "1.0.0",
    "timestamp": "2026-06-06T12:00:00.000Z",
    "checks": {
      "database": {
        "status": "down",
        "error": "Connection refused"
      }
    }
  },
  "meta": null,
  "error": null
}
```

---

## Public Endpoints

### GET /.well-known/jwks.json

Public JSON Web Key Set endpoint for JWT verification. Mimics OIDC discovery.

**Authentication:** None

**HMAC:** Not required

#### Success Response — 200 OK

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "local-dev-key-1",
      "n": "0vx7agoe...",
      "e": "AQAB"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `kty` | Key type (`RSA`) |
| `use` | Key usage (`sig` for signature) |
| `alg` | Algorithm (`RS256`) |
| `kid` | Key ID for matching with JWT header |
| `n` | RSA modulus (base64url) |
| `e` | RSA exponent (base64url) |

---

## Related Documentation

- [Security Model](./security.md) — HMAC signing protocol and auth flow
- [Architecture](./architecture.md) — System design and module structure
- [Observability](./observability.md) — Correlation IDs and logging
- [Testing](./testing.md) — API integration test examples

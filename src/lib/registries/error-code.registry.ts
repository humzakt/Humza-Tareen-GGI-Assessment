import { HTTP_STATUS } from '../constants/http.constants';

export interface ErrorConfig {
  status: number;
  template: string;
}

export const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Invalid email or password.',
  },
  TOKEN_EXPIRED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Access token has expired.',
  },
  TOKEN_INVALID: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Invalid or malformed access token.',
  },
  REFRESH_TOKEN_INVALID: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Invalid or expired refresh token.',
  },
  UNAUTHORIZED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Authentication required.',
  },

  // HMAC errors
  INVALID_SIGNATURE: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Request signature verification failed.',
  },
  TIMESTAMP_EXPIRED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    template: 'Request timestamp is too old or missing.',
  },

  // RBAC errors
  FORBIDDEN: {
    status: HTTP_STATUS.FORBIDDEN,
    template: 'Insufficient permissions. Required role: {requiredRole}.',
  },
  RESOURCE_FORBIDDEN: {
    status: HTTP_STATUS.FORBIDDEN,
    template: 'You do not have access to this resource.',
  },

  // Quota errors
  QUOTA_EXHAUSTED: {
    status: HTTP_STATUS.FORBIDDEN,
    template: 'Monthly quota exhausted. Purchase a subscription bundle.',
  },

  // Subscription errors
  SUBSCRIPTION_INACTIVE: {
    status: HTTP_STATUS.FORBIDDEN,
    template: 'Subscription {id} is inactive.',
  },
  SUBSCRIPTION_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    template: 'Subscription {id} not found.',
  },
  INVALID_TIER: {
    status: HTTP_STATUS.BAD_REQUEST,
    template: 'Invalid subscription tier: {tier}.',
  },
  INVALID_BILLING_CYCLE: {
    status: HTTP_STATUS.BAD_REQUEST,
    template: 'Invalid billing cycle: {cycle}.',
  },

  // User errors
  USER_ALREADY_EXISTS: {
    status: HTTP_STATUS.CONFLICT,
    template: 'User with email {email} already exists.',
  },
  USER_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    template: 'User not found.',
  },

  // Validation errors
  VALIDATION_ERROR: {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    template: 'Request validation failed.',
  },
  INVALID_CONTENT_TYPE: {
    status: HTTP_STATUS.BAD_REQUEST,
    template: 'Content-Type must be application/json.',
  },

  // System errors
  INTERNAL_ERROR: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    template: 'An unexpected error occurred.',
  },
  SERVICE_UNAVAILABLE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    template: 'Service temporarily unavailable.',
  },
  RATE_LIMIT_EXCEEDED: {
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    template: 'Rate limit exceeded. Try again later.',
  },
  REQUEST_TIMEOUT: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    template: 'Request timed out.',
  },
} as const satisfies Record<string, ErrorConfig>;

export type ErrorCode = keyof typeof ERROR_CODES;

export function getErrorConfig(code: ErrorCode): ErrorConfig {
  return ERROR_CODES[code];
}

export function isValidErrorCode(code: string): code is ErrorCode {
  return code in ERROR_CODES;
}

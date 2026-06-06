export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
  REQUEST_TIMESTAMP: 'x-request-timestamp',
  REQUEST_SIGNATURE: 'x-request-signature',
  CONTENT_TYPE: 'content-type',
} as const;

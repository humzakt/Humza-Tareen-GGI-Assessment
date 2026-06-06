import { PaginationMeta } from '../types/pagination.types';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: Record<string, unknown> | null;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    correlationId?: string;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
  error: null;
}

export function success<T>(data: T, meta?: Record<string, unknown> | null): ApiResponse<T> {
  return { success: true, data, meta: meta ?? null, error: null };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    success: true,
    data: items,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
    error: null,
  };
}

export function errorResponse(
  code: string,
  message: string,
  correlationId?: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    success: false,
    data: null,
    error: { code, message, details, correlationId },
  };
}

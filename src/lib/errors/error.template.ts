import { getErrorConfig, ErrorCode } from '../registries/error-code.registry';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, details?: Record<string, unknown>) {
    const config = getErrorConfig(code);
    const message = interpolate(config.template, details);
    super(message);
    this.code = code;
    this.status = config.status;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function createAppError(code: ErrorCode, details?: Record<string, unknown>): AppError {
  return new AppError(code, details);
}

function interpolate(template: string, data?: Record<string, unknown>): string {
  if (!data) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = data[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

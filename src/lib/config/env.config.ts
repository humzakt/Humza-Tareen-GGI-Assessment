import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_ISSUER: z.string().default('http://localhost:3000'),
  JWT_AUDIENCE: z.string().default('local-api'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  HMAC_SECRET: z.string().min(16).default('local-dev-hmac-secret-change-in-production'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  PAYMENT_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const messages = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, val]) => {
        const errors = (val as { _errors?: string[] })._errors ?? [];
        return `  ${key}: ${errors.join(', ')}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return result.data;
}

export const env = loadConfig();

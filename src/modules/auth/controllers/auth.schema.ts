import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
}).strict();

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
}).strict();

export const oauthCallbackQuerySchema = z.object({
  email: z.string().email('Invalid email format'),
});

import { z } from 'zod';

export const sendMessageSchema = z.object({
  question: z.string().min(1, 'Question is required').max(4000, 'Question too long'),
}).strict();

export const chatHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

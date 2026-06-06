import winston from 'winston';
import { env } from '../config/env.config';
import { LogEvent, LogModule } from './logger.constants';

export interface LogEntry {
  timestamp: string;
  level: string;
  event: LogEvent;
  correlationId: string;
  requestId: string;
  userId?: string;
  module: LogModule;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

const devFormat = winston.format.printf(({ level, event, module, correlationId, metadata, timestamp }) => {
  const meta = metadata ? ` ${JSON.stringify(metadata)}` : '';
  return `${timestamp} [${level}] [${module}] ${event} cid=${correlationId}${meta}`;
});

const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'ISO' }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'secure-backend' },
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'development'
          ? winston.format.combine(winston.format.colorize(), winston.format.timestamp(), devFormat)
          : winston.format.json(),
    }),
  ],
});

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  module: LogModule;
}

export const logger = {
  info(event: LogEvent, context: LogContext, metadata?: Record<string, unknown>): void {
    winstonLogger.info(event, {
      event,
      correlationId: context.correlationId ?? 'system',
      requestId: context.requestId ?? 'system',
      userId: context.userId,
      module: context.module,
      metadata,
    });
  },

  warn(event: LogEvent, context: LogContext, metadata?: Record<string, unknown>): void {
    winstonLogger.warn(event, {
      event,
      correlationId: context.correlationId ?? 'system',
      requestId: context.requestId ?? 'system',
      userId: context.userId,
      module: context.module,
      metadata,
    });
  },

  error(event: LogEvent, context: LogContext, metadata?: Record<string, unknown>): void {
    winstonLogger.error(event, {
      event,
      correlationId: context.correlationId ?? 'system',
      requestId: context.requestId ?? 'system',
      userId: context.userId,
      module: context.module,
      metadata,
    });
  },

  debug(event: LogEvent, context: LogContext, metadata?: Record<string, unknown>): void {
    winstonLogger.debug(event, {
      event,
      correlationId: context.correlationId ?? 'system',
      requestId: context.requestId ?? 'system',
      userId: context.userId,
      module: context.module,
      metadata,
    });
  },
};

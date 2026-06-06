import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { ContextRequest } from '../types/request.types';

interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationTarget) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = (req as ContextRequest).context;
    const errors: Array<{ field: string; message: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, 'body'));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, 'query'));
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, 'params'));
      } else {
        req.params = result.data as typeof req.params;
      }
    }

    if (errors.length > 0) {
      res.status(422).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: { errors },
          correlationId: ctx?.correlationId,
        },
      });
      return;
    }

    next();
  };
}

function formatZodErrors(
  error: ZodError,
  source: string,
): Array<{ field: string; message: string }> {
  return error.issues.map((e: ZodIssue) => ({
    field: `${source}.${e.path.join('.')}`,
    message: e.message,
  }));
}

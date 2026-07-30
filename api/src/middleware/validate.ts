import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and *replaces* the request segment with the parsed value, so
 * handlers only ever see data that matched the schema.
 */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(zodToAppError(result.error));

    if (source === 'query') {
      // Express 5 makes req.query a getter; define instead of assign.
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

export function zodToAppError(error: ZodError): AppError {
  return new AppError(
    422,
    'VALIDATION_ERROR',
    'Some of the submitted values are not valid',
    error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  );
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;

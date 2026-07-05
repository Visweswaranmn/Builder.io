import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validates `req.body` against a Zod schema, replacing it with the parsed
 * (and thus type-coerced/defaulted) value on success. On failure, throws a
 * 400 ApiError with per-field details.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates `req.query` against a Zod schema. The parsed result is attached to
 * `req.validatedQuery` rather than reassigned onto `req.query` — Express types
 * `query` as a string-only `ParsedQs`, which can't hold the coerced
 * numbers/enums a query schema typically produces.
 */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Invalid query parameters', details));
    }
    req.validatedQuery = result.data;
    next();
  };
}

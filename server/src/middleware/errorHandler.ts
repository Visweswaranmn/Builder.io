import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface ErrorResponse {
  success: false;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * Global error handler. Must be registered last, after all routes.
 * Normalizes known error shapes (ApiError, Mongoose validation/cast/duplicate)
 * into a consistent JSON envelope.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${String(err.value)}`;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    message = 'Duplicate value violates a unique constraint';
    details = err.keyValue;
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  if (statusCode >= 500) {
    logger.error(`${statusCode} ${message}`, err);
  }

  const body: ErrorResponse = { success: false, message };
  if (details !== undefined) body.details = details;
  if (!env.isProd && err instanceof Error) body.stack = err.stack;

  res.status(statusCode).json(body);
}

function isDuplicateKeyError(
  err: unknown,
): err is { code: number; keyValue: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  );
}

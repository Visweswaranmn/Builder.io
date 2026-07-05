import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

/** Catches any request that did not match a route and hands off a 404. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

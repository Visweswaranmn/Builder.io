import type { UserRole } from '../constants/enums.js';

/** Minimal identity attached to `req` by the `authenticate` middleware. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Populated by `validateQuery` — the Zod-parsed, type-coerced query params. */
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};

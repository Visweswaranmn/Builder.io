import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { UserRole } from '../constants/enums.js';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

/**
 * Signs a short-lived access token carrying the user id + role.
 * Includes a random `jti` so two tokens issued in the same second (identical
 * `iat`) still come out distinct — needed for refresh-token rotation to be
 * verifiably fresh, and useful groundwork for future revocation lists.
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  } as SignOptions);
}

/** Signs a longer-lived refresh token used solely to mint new access tokens. */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}

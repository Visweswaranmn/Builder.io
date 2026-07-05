import crypto from 'node:crypto';

/**
 * Generates a random token to hand to the user (e.g. in a reset-password link)
 * along with its SHA-256 hash to persist. Only the hash is stored, so a
 * database leak alone can't be used to reset accounts.
 */
export function generateResetToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

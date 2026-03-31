import crypto from 'node:crypto';

export const RUNNER_SECRET_MISCONFIGURED = 'Runner misconfigured: PLAYWRIGHT_RUNNER_SECRET is not set';

/**
 * Validates Authorization header against the configured runner secret.
 * Accepts case-insensitive Bearer scheme and trims incidental surrounding whitespace.
 */
export function checkAuth(authHeader: string | undefined, secret: string): string | null {
  if (!secret) {
    return RUNNER_SECRET_MISCONFIGURED;
  }

  if (!authHeader) {
    return 'Unauthorized';
  }

  const match = authHeader.match(/^\s*Bearer\s+(.+?)\s*$/i);
  if (!match) {
    return 'Unauthorized';
  }

  const token = match[1];
  if (!token) {
    return 'Unauthorized';
  }

  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(secret, 'utf8');

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return 'Unauthorized';
  }

  return null;
}

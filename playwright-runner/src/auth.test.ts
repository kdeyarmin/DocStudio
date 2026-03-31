import { describe, expect, it } from 'vitest';
import { checkAuth, RUNNER_SECRET_MISCONFIGURED } from './auth';

describe('checkAuth', () => {
  const secret = 'super-secret-token';

  it('returns misconfigured error when runner secret is empty', () => {
    expect(checkAuth('Bearer anything', '')).toBe(RUNNER_SECRET_MISCONFIGURED);
  });

  it('rejects missing authorization header', () => {
    expect(checkAuth(undefined, secret)).toBe('Unauthorized');
  });

  it('rejects non-bearer authorization scheme', () => {
    expect(checkAuth('Basic abc123', secret)).toBe('Unauthorized');
  });

  it('accepts bearer token case-insensitively', () => {
    expect(checkAuth(`bearer ${secret}`, secret)).toBeNull();
  });

  it('accepts bearer token with incidental whitespace', () => {
    expect(checkAuth(`  Bearer   ${secret}   `, secret)).toBeNull();
  });

  it('rejects wrong token', () => {
    expect(checkAuth('Bearer wrong-token', secret)).toBe('Unauthorized');
  });
});

import { describe, it, expect } from 'vitest';
import {
  isNonEmptyString,
  validateCallbackUrl,
  validateRunRequest,
} from '../validation';

// ── isNonEmptyString ──────────────────────────────────────────────────────────

describe('isNonEmptyString', () => {
  it('returns true for a non-empty string', () => {
    expect(isNonEmptyString('hello')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(isNonEmptyString('   ')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNonEmptyString(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isNonEmptyString(undefined)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isNonEmptyString(42)).toBe(false);
  });
});

// ── validateCallbackUrl ───────────────────────────────────────────────────────

describe('validateCallbackUrl (no SUPABASE_ORIGIN configured)', () => {
  const noOrigin = null;

  it('accepts a valid https URL', () => {
    const result = validateCallbackUrl('https://example.com/functions/v1/callback', noOrigin);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('https://example.com/functions/v1/callback');
  });

  it('accepts a valid http URL (dev environment)', () => {
    const result = validateCallbackUrl('http://localhost:54321/functions/v1/callback', noOrigin);
    expect(result.ok).toBe(true);
  });

  it('rejects a malformed URL', () => {
    const result = validateCallbackUrl('not-a-url', noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid absolute URL/);
  });

  it('rejects a relative URL', () => {
    const result = validateCallbackUrl('/functions/v1/callback', noOrigin);
    expect(result.ok).toBe(false);
  });

  it('rejects ftp:// protocol', () => {
    const result = validateCallbackUrl('ftp://example.com/path', noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/http or https/);
  });

  it('rejects URLs with embedded credentials', () => {
    const result = validateCallbackUrl('https://user:pass@example.com/path', noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/credentials/);
  });

  it('rejects URLs with only username (no password)', () => {
    const result = validateCallbackUrl('https://user@example.com/path', noOrigin);
    expect(result.ok).toBe(false);
  });
});

describe('validateCallbackUrl (with SUPABASE_ORIGIN configured)', () => {
  const origin = 'https://abcdef.supabase.co';

  it('accepts a URL targeting the configured origin', () => {
    const result = validateCallbackUrl(`${origin}/functions/v1/my-fn`, origin);
    expect(result.ok).toBe(true);
  });

  it('rejects a URL targeting a different origin', () => {
    const result = validateCallbackUrl('https://evil.com/functions/v1/fn', origin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Supabase project origin/);
  });

  it('rejects a URL with correct origin but wrong path prefix', () => {
    const result = validateCallbackUrl(`${origin}/api/other`, origin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Edge Function endpoint/);
  });

  it('accepts a URL with correct origin and /functions/v1/ path prefix', () => {
    const result = validateCallbackUrl(`${origin}/functions/v1/doc-studio-jobs`, origin);
    expect(result.ok).toBe(true);
  });
});

// ── validateRunRequest ────────────────────────────────────────────────────────

function minimalStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    title: 'Click button',
    step_order: 1,
    action_type: 'click',
    ...overrides,
  };
}

function minimalBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    job_id: 'job-abc',
    workflow: { id: 'wf-1', name: 'Test', start_url: 'https://app.example.com', steps: [minimalStep()] },
    settings: { viewport_width: 1280 },
    callback_url: 'https://supabase.co/functions/v1/callback',
    callback_token: 'secret-token',
    ...overrides,
  };
}

describe('validateRunRequest (no SUPABASE_ORIGIN)', () => {
  const noOrigin = null;

  it('accepts a minimal valid body', () => {
    const result = validateRunRequest(minimalBody(), noOrigin);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.job_id).toBe('job-abc');
    }
  });

  it('trims whitespace from job_id', () => {
    const result = validateRunRequest(minimalBody({ job_id: '  job-abc  ' }), noOrigin);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.job_id).toBe('job-abc');
  });

  it('rejects null body', () => {
    const result = validateRunRequest(null, noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON object/);
  });

  it('rejects non-object body', () => {
    const result = validateRunRequest('string', noOrigin);
    expect(result.ok).toBe(false);
  });

  it('rejects missing job_id', () => {
    const result = validateRunRequest(minimalBody({ job_id: undefined }), noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/job_id/);
  });

  it('rejects empty string job_id', () => {
    const result = validateRunRequest(minimalBody({ job_id: '' }), noOrigin);
    expect(result.ok).toBe(false);
  });

  it('rejects missing workflow', () => {
    const result = validateRunRequest(minimalBody({ workflow: undefined }), noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/workflow/);
  });

  it('rejects workflow with non-array steps', () => {
    const result = validateRunRequest(
      minimalBody({ workflow: { steps: 'not-an-array' } }),
      noOrigin,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/steps must be an array/);
  });

  it('rejects a step missing id', () => {
    const result = validateRunRequest(
      minimalBody({ workflow: { steps: [minimalStep({ id: '' })] } }),
      noOrigin,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid step/);
  });

  it('rejects a step missing title', () => {
    const result = validateRunRequest(
      minimalBody({ workflow: { steps: [minimalStep({ title: '' })] } }),
      noOrigin,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a step with non-numeric step_order', () => {
    const result = validateRunRequest(
      minimalBody({ workflow: { steps: [minimalStep({ step_order: 'one' })] } }),
      noOrigin,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a step missing action_type', () => {
    const result = validateRunRequest(
      minimalBody({ workflow: { steps: [minimalStep({ action_type: '' })] } }),
      noOrigin,
    );
    expect(result.ok).toBe(false);
  });

  it('accepts empty steps array', () => {
    const result = validateRunRequest(
      minimalBody({ workflow: { steps: [] } }),
      noOrigin,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects missing settings', () => {
    const result = validateRunRequest(minimalBody({ settings: undefined }), noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/settings/);
  });

  it('rejects missing callback_url', () => {
    const result = validateRunRequest(minimalBody({ callback_url: undefined }), noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/callback_url/);
  });

  it('rejects invalid callback_url', () => {
    const result = validateRunRequest(minimalBody({ callback_url: 'not-a-url' }), noOrigin);
    expect(result.ok).toBe(false);
  });

  it('rejects missing callback_token', () => {
    const result = validateRunRequest(minimalBody({ callback_token: undefined }), noOrigin);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/callback_token/);
  });
});

describe('validateRunRequest (with SUPABASE_ORIGIN)', () => {
  const origin = 'https://abc.supabase.co';

  it('accepts callback_url matching the Supabase origin', () => {
    const result = validateRunRequest(
      minimalBody({ callback_url: `${origin}/functions/v1/doc-studio-jobs` }),
      origin,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects callback_url targeting a different origin', () => {
    const result = validateRunRequest(
      minimalBody({ callback_url: 'https://evil.com/functions/v1/steal' }),
      origin,
    );
    expect(result.ok).toBe(false);
  });
});

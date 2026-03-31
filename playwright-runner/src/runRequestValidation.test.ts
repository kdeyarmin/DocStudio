import { describe, expect, it } from 'vitest';
import { validateCallbackUrl, validateRunRequest } from './runRequestValidation';

const goodOrigin = 'https://abc.supabase.co';

const minimalBody = {
  job_id: ' j1 ',
  workflow: {
    steps: [
      {
        id: 's1',
        title: 't',
        step_order: 1,
        action_type: 'click',
      },
    ],
  },
  settings: {},
  callback_url: 'https://abc.supabase.co/functions/v1/doc-studio-jobs',
  callback_token: 'anon-key',
};

describe('runRequestValidation', () => {
  it('rejects callback URLs from other origins', () => {
    const r = validateCallbackUrl('https://evil.com/x', goodOrigin);
    expect(r.ok).toBe(false);
  });

  it('requires configured SUPABASE_URL origin', () => {
    const r = validateCallbackUrl('https://abc.supabase.co/functions/v1/doc-studio-jobs', null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/SUPABASE_URL/);
  });

  it('accepts valid callback URL', () => {
    const r = validateCallbackUrl('https://abc.supabase.co/functions/v1/doc-studio-jobs', goodOrigin);
    expect(r.ok).toBe(true);
  });

  it('accepts valid request and normalizes fields', () => {
    const r = validateRunRequest(minimalBody, goodOrigin);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.job_id).toBe('j1');
      expect(r.value.callback_token).toBe('anon-key');
    }
  });

  it('accepts supabase_anon_key alias', () => {
    const r = validateRunRequest(
      { ...minimalBody, supabase_anon_key: 'from-alias', callback_token: '' },
      goodOrigin,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.callback_token).toBe('from-alias');
  });

  it('rejects missing supabase origin', () => {
    const r = validateRunRequest(minimalBody, null);
    expect(r.ok).toBe(false);
  });

  it('rejects excessive step counts', () => {
    const tooManySteps = {
      ...minimalBody,
      workflow: {
        steps: Array.from({ length: 251 }, (_, i) => ({
          id: `s-${i}`,
          title: 't',
          step_order: i + 1,
          action_type: 'click',
        })),
      },
    };
    const r = validateRunRequest(tooManySteps, goodOrigin);
    expect(r.ok).toBe(false);
  });

  it('rejects oversized job_id values', () => {
    const r = validateRunRequest({ ...minimalBody, job_id: ' '.repeat(129) }, goodOrigin);
    expect(r.ok).toBe(false);
  });
});

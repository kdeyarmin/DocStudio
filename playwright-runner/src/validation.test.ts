import { describe, it, expect } from 'vitest';
import { isNonEmptyString, validateCallbackUrl, validateRunRequest } from './validation';

// ── isNonEmptyString ─────────────────────────────────────────────────────────

describe('isNonEmptyString', () => {
  it('returns true for non-empty string', () => {
    expect(isNonEmptyString('hello')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isNonEmptyString('   ')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNonEmptyString(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isNonEmptyString(undefined)).toBe(false);
  });

  it('returns false for number', () => {
    expect(isNonEmptyString(42)).toBe(false);
  });
});

// ── validateCallbackUrl ──────────────────────────────────────────────────────

describe('validateCallbackUrl', () => {
  const SUPABASE_ORIGIN = 'https://project.supabase.co';

  it('accepts valid https URL targeting Supabase edge function', () => {
    const result = validateCallbackUrl(
      'https://project.supabase.co/functions/v1/my-function',
      SUPABASE_ORIGIN,
    );
    expect(result.ok).toBe(true);
  });

  it('accepts http URL when origin matches', () => {
    const result = validateCallbackUrl(
      'http://localhost:54321/functions/v1/callback',
      'http://localhost:54321',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = validateCallbackUrl('not-a-url', SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('valid absolute URL');
  });

  it('rejects ftp: protocol', () => {
    const result = validateCallbackUrl('ftp://evil.com/file', SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('http or https');
  });

  it('rejects javascript: protocol', () => {
    const result = validateCallbackUrl('javascript:alert(1)', SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
  });

  it('rejects URL with embedded credentials', () => {
    const result = validateCallbackUrl(
      'https://user:pass@project.supabase.co/functions/v1/hook',
      SUPABASE_ORIGIN,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('credentials');
  });

  it('rejects URL targeting a different origin', () => {
    const result = validateCallbackUrl(
      'https://evil.com/functions/v1/callback',
      SUPABASE_ORIGIN,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Supabase project origin');
  });

  it('rejects URL not targeting /functions/v1/ path', () => {
    const result = validateCallbackUrl(
      'https://project.supabase.co/admin/delete-all',
      SUPABASE_ORIGIN,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Edge Function endpoint');
  });

  it('allows any origin when supabaseOrigin is null', () => {
    const result = validateCallbackUrl('https://any-host.example.com/callback', null);
    expect(result.ok).toBe(true);
  });

  it('allows any path when supabaseOrigin is null', () => {
    const result = validateCallbackUrl('https://any-host.example.com/any/path', null);
    expect(result.ok).toBe(true);
  });

  it('rejects data: URI', () => {
    const result = validateCallbackUrl('data:text/html,<h1>hi</h1>', null);
    expect(result.ok).toBe(false);
  });

  it('normalizes the URL in the returned value', () => {
    const result = validateCallbackUrl(
      'https://project.supabase.co/functions/v1/hook?a=1',
      SUPABASE_ORIGIN,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('https://project.supabase.co/functions/v1/hook?a=1');
  });
});

// ── validateRunRequest ───────────────────────────────────────────────────────

describe('validateRunRequest', () => {
  const SUPABASE_ORIGIN = 'https://project.supabase.co';

  function makeValidBody() {
    return {
      job_id: 'job-1',
      workflow: {
        id: 'wf-1',
        name: 'Test',
        start_url: '/test',
        success_url_pattern: null,
        requires_auth: false,
        uses_demo_account: false,
        steps: [
          {
            id: 'step-1',
            title: 'Click button',
            step_order: 1,
            action_type: 'click',
            target_selector: '#btn',
            action_value: null,
            expected_result: null,
            wait_strategy: 'none',
            screenshot_checkpoint: false,
            screenshot_caption_template: '',
            fallback_instruction: null,
            timeout_seconds: 10,
            ai_observation_prompt: null,
            is_optional: false,
            error_handling_strategy: 'fail',
            retry_count: 0,
            selector_strategy: 'css',
            step_metadata_json: {},
            description: null,
          },
        ],
      },
      demo_account: null,
      settings: {
        playwright_base_url: '',
        playwright_login_path: '/login',
        playwright_username_selector: '',
        playwright_password_selector: '',
        playwright_submit_selector: '',
        playwright_success_url_pattern: '',
        viewport_width: 1280,
        viewport_height: 800,
        headless: true,
        trace_enabled: false,
        screenshots_enabled: true,
        video_enabled: false,
        retain_partial_assets_on_failure: false,
        step_timeout_ms: 30000,
        action_timeout_ms: 10000,
        navigation_timeout_ms: 30000,
      },
      callback_url: 'https://project.supabase.co/functions/v1/doc-studio-playwright',
      callback_token: 'token-abc',
    };
  }

  it('accepts a fully valid request', () => {
    const result = validateRunRequest(makeValidBody(), SUPABASE_ORIGIN);
    expect(result.ok).toBe(true);
  });

  it('rejects null body', () => {
    const result = validateRunRequest(null, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('JSON object');
  });

  it('rejects missing job_id', () => {
    const body = makeValidBody();
    delete (body as Record<string, unknown>).job_id;
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('job_id');
  });

  it('rejects whitespace-only job_id', () => {
    const body = makeValidBody();
    body.job_id = '   ';
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('job_id');
  });

  it('rejects missing workflow', () => {
    const body = makeValidBody();
    delete (body as Record<string, unknown>).workflow;
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('workflow');
  });

  it('rejects missing workflow.steps', () => {
    const body = makeValidBody();
    delete (body.workflow as Record<string, unknown>).steps;
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('steps');
  });

  it('rejects invalid step definition', () => {
    const body = makeValidBody();
    body.workflow.steps = [{ id: '', title: 'bad', step_order: 1, action_type: 'click' } as never];
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('invalid step');
  });

  it('rejects missing settings', () => {
    const body = makeValidBody();
    delete (body as Record<string, unknown>).settings;
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('settings');
  });

  it('rejects missing callback_url', () => {
    const body = makeValidBody();
    delete (body as Record<string, unknown>).callback_url;
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('callback_url');
  });

  it('rejects callback_url targeting wrong origin', () => {
    const body = makeValidBody();
    body.callback_url = 'https://evil.com/functions/v1/hook';
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Supabase project origin');
  });

  it('rejects missing callback_token', () => {
    const body = makeValidBody();
    delete (body as Record<string, unknown>).callback_token;
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('callback_token');
  });

  it('trims job_id in the validated output', () => {
    const body = makeValidBody();
    body.job_id = '  job-trimmed  ';
    const result = validateRunRequest(body, SUPABASE_ORIGIN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.job_id).toBe('job-trimmed');
  });
});

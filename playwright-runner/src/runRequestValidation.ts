import type { RunRequest } from './types';

const MAX_STEPS = 250;
const MAX_JOB_ID_LENGTH = 128;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateCallbackUrl(
  callbackUrl: string,
  supabaseOrigin: string | null,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!supabaseOrigin) {
    return {
      ok: false,
      error: 'Server misconfigured: valid SUPABASE_URL is required to validate callback_url',
    };
  }

  let parsed: URL;

  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, error: 'callback_url must be a valid absolute URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'callback_url must use http or https' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'callback_url must not include credentials' };
  }

  if (parsed.origin !== supabaseOrigin) {
    return {
      ok: false,
      error: 'callback_url must target the configured Supabase project origin',
    };
  }

  if (!parsed.pathname.startsWith('/functions/v1/')) {
    return {
      ok: false,
      error: 'callback_url must target a Supabase Edge Function endpoint',
    };
  }

  return { ok: true, value: parsed.toString() };
}

/** Accepts legacy `callback_token` or clearer `supabase_anon_key` (same value for createClient). */
export function resolveSupabaseKey(candidate: Partial<RunRequest> & { supabase_anon_key?: string }): string | null {
  const fromAlias = candidate.supabase_anon_key;
  if (isNonEmptyString(fromAlias)) return fromAlias.trim();
  if (isNonEmptyString(candidate.callback_token)) return candidate.callback_token.trim();
  return null;
}

export function validateRunRequest(
  body: unknown,
  supabaseOrigin: string | null,
): { ok: true; value: RunRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const candidate = body as Partial<RunRequest> & { supabase_anon_key?: string };

  if (!isNonEmptyString(candidate.job_id)) {
    return { ok: false, error: 'job_id is required' };
  }
  if (candidate.job_id.trim().length > MAX_JOB_ID_LENGTH) {
    return { ok: false, error: `job_id exceeds max length (${MAX_JOB_ID_LENGTH})` };
  }

  if (!candidate.workflow || typeof candidate.workflow !== 'object') {
    return { ok: false, error: 'workflow is required' };
  }

  if (!Array.isArray(candidate.workflow.steps)) {
    return { ok: false, error: 'workflow.steps must be an array' };
  }
  if (candidate.workflow.steps.length === 0) {
    return { ok: false, error: 'workflow.steps must not be empty' };
  }
  if (candidate.workflow.steps.length > MAX_STEPS) {
    return { ok: false, error: `workflow.steps exceeds maximum (${MAX_STEPS})` };
  }

  const invalidStep = candidate.workflow.steps.find(
    (step) =>
      !step ||
      typeof step !== 'object' ||
      !isNonEmptyString((step as { id?: unknown }).id) ||
      !isNonEmptyString((step as { title?: unknown }).title) ||
      typeof (step as { step_order?: unknown }).step_order !== 'number' ||
      !isNonEmptyString((step as { action_type?: unknown }).action_type),
  );

  if (invalidStep) {
    return { ok: false, error: 'workflow.steps contains an invalid step definition' };
  }

  if (!candidate.settings || typeof candidate.settings !== 'object') {
    return { ok: false, error: 'settings is required' };
  }

  if (!isNonEmptyString(candidate.callback_url)) {
    return { ok: false, error: 'callback_url is required' };
  }

  const callbackUrlResult = validateCallbackUrl(candidate.callback_url, supabaseOrigin);
  if (!callbackUrlResult.ok) {
    return callbackUrlResult;
  }

  const supabaseKey = resolveSupabaseKey(candidate);
  if (!supabaseKey) {
    return { ok: false, error: 'callback_token or supabase_anon_key is required' };
  }

  return {
    ok: true,
    value: {
      ...candidate,
      job_id: candidate.job_id.trim(),
      callback_url: callbackUrlResult.value,
      callback_token: supabaseKey,
    } as RunRequest,
  };
}

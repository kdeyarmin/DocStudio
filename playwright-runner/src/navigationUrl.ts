import path from 'node:path';

/**
 * Builds the set of origins the runner may navigate to (Playwright goto / waitForURL).
 * SUPABASE_URL contributes one origin; PLAYWRIGHT_ALLOWED_BASE_ORIGINS adds more (comma-separated).
 */
export function buildAllowedNavigationOrigins(): Set<string> {
  const set = new Set<string>();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
  if (supabaseUrl) {
    try {
      set.add(new URL(supabaseUrl).origin);
    } catch {
      /* ignore invalid */
    }
  }
  const extra = process.env.PLAYWRIGHT_ALLOWED_BASE_ORIGINS?.split(',') ?? [];
  for (const raw of extra) {
    const piece = raw.trim();
    if (!piece) continue;
    try {
      set.add(new URL(piece).origin);
    } catch {
      /* ignore invalid entries */
    }
  }
  return set;
}

/**
 * Rejects protocol-relative URLs and non-http(s) schemes. Origin must be in the allowlist.
 */
export function assertAllowedNavigationUrl(
  urlStr: string,
  allowedOrigins: ReadonlySet<string>,
): string {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    throw new Error('URL is empty');
  }
  if (trimmed.startsWith('//')) {
    throw new Error('Protocol-relative URLs are not allowed');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL must not include credentials');
  }

  if (allowedOrigins.size === 0) {
    throw new Error(
      'No allowed navigation origins configured (set SUPABASE_URL and/or PLAYWRIGHT_ALLOWED_BASE_ORIGINS)',
    );
  }
  if (!allowedOrigins.has(parsed.origin)) {
    throw new Error(`Navigation blocked: origin ${parsed.origin} is not in the allowlist`);
  }

  return parsed.toString();
}

/** Only validates absolute http(s) URLs; relative paths are left to the browser base URL. */
export function assertNavigationTargetIfAbsolute(
  urlStr: string,
  allowedOrigins: ReadonlySet<string>,
): void {
  const trimmed = urlStr.trim();
  if (!/^https?:\/\//i.test(trimmed)) return;
  assertAllowedNavigationUrl(trimmed, allowedOrigins);
}

const SAFE_ENV_KEY = /^[A-Z][A-Z0-9_]*$/;

export function resolveDemoPasswordEnvKey(rawKey: string | undefined): string {
  const key = (rawKey ?? 'DEMO_ACCOUNT_PASSWORD').trim();
  if (!SAFE_ENV_KEY.test(key)) {
    throw new Error('Invalid env_password_key: use only A–Z, 0–9, underscore, starting with a letter');
  }
  return key;
}

/**
 * Resolves upload paths to an absolute path under PLAYWRIGHT_UPLOAD_ROOT (default: tmp doc-studio folder).
 */
export function resolveAllowedUploadPath(userPath: string): string {
  const rootRaw = process.env.PLAYWRIGHT_UPLOAD_ROOT?.trim();
  const root = path.resolve(rootRaw && rootRaw.length > 0 ? rootRaw : path.join('/tmp', 'doc-studio-uploads'));
  const resolved = path.resolve(userPath.trim());
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `upload_file path must be under PLAYWRIGHT_UPLOAD_ROOT (${root})`,
    );
  }
  return resolved;
}

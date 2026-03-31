/**
 * Unit tests for AI proxy helper functions.
 *
 * Run with:
 *   deno test --allow-none supabase/functions/_shared/ai-proxy-helpers.test.ts
 */
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { toMessageContent, resolveOrganizationId, type SupabaseClientLike } from './ai-proxy-helpers.ts';

// ── toMessageContent ─────────────────────────────────────────────────────────

Deno.test('toMessageContent: returns trimmed string for string input', () => {
  assertEquals(toMessageContent('  hello world  '), 'hello world');
});

Deno.test('toMessageContent: returns empty trimmed string as empty', () => {
  assertEquals(toMessageContent('   '), '');
});

Deno.test('toMessageContent: returns null for null/undefined', () => {
  assertEquals(toMessageContent(null), null);
  assertEquals(toMessageContent(undefined), null);
});

Deno.test('toMessageContent: returns null for number', () => {
  assertEquals(toMessageContent(42), null);
});

Deno.test('toMessageContent: returns null for boolean', () => {
  assertEquals(toMessageContent(true), null);
});

Deno.test('toMessageContent: extracts text from array of strings', () => {
  assertEquals(toMessageContent(['hello', ' world']), 'hello\n world');
});

Deno.test('toMessageContent: extracts text from array of {text} objects', () => {
  assertEquals(
    toMessageContent([{ text: 'part1' }, { text: 'part2' }]),
    'part1\npart2',
  );
});

Deno.test('toMessageContent: mixed array of strings and {text} objects', () => {
  assertEquals(
    toMessageContent(['intro', { text: 'body' }, 'outro']),
    'intro\nbody\noutro',
  );
});

Deno.test('toMessageContent: filters out non-text items from arrays', () => {
  assertEquals(
    toMessageContent([{ image: 'data' }, '', { text: 'valid' }]),
    'valid',
  );
});

Deno.test('toMessageContent: returns empty string for array of empty items', () => {
  assertEquals(toMessageContent(['', { text: '' }]), '');
});

Deno.test('toMessageContent: returns null for empty array', () => {
  assertEquals(toMessageContent([]), '');
});

Deno.test('toMessageContent: handles {text} with non-string text property', () => {
  assertEquals(toMessageContent([{ text: 42 }]), '');
});

// ── resolveOrganizationId ────────────────────────────────────────────────────

function createMockSupabase(opts: {
  profileOrgId?: string | null;
  isSuperAdmin?: boolean;
  membershipOrgId?: string | null;
  profileMissing?: boolean;
}): SupabaseClientLike {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const filters = new Map<string, unknown>();
          const chain = {
            eq(column: string, value: unknown) {
              filters.set(column, value);
              return chain;
            },
            limit(_n: number) {
              return chain;
            },
            maybeSingle() {
              if (table === 'profiles') {
                if (opts.profileMissing) {
                  return Promise.resolve({ data: null, error: null });
                }
                return Promise.resolve({
                  data: {
                    organization_id: opts.profileOrgId ?? null,
                    is_super_admin: opts.isSuperAdmin ?? false,
                  },
                  error: null,
                });
              }
              if (table === 'organization_members') {
                if (opts.membershipOrgId) {
                  return Promise.resolve({
                    data: { organization_id: opts.membershipOrgId },
                    error: null,
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
          return chain;
        },
      };
    },
  };
}

Deno.test('resolveOrganizationId: returns requestedOrgId when provided', async () => {
  const supabase = createMockSupabase({ profileOrgId: 'profile-org' });
  const result = await resolveOrganizationId(supabase, 'user-1', 'requested-org');
  assertEquals(result.organizationId, 'requested-org');
});

Deno.test('resolveOrganizationId: returns profile org when no requestedOrgId', async () => {
  const supabase = createMockSupabase({ profileOrgId: 'profile-org' });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, 'profile-org');
});

Deno.test('resolveOrganizationId: falls back to membership org when profile org is null', async () => {
  const supabase = createMockSupabase({
    profileOrgId: null,
    membershipOrgId: 'member-org',
  });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, 'member-org');
});

Deno.test('resolveOrganizationId: returns null when no org found anywhere', async () => {
  const supabase = createMockSupabase({
    profileOrgId: null,
    membershipOrgId: null,
  });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, null);
});

Deno.test('resolveOrganizationId: returns null when profile is missing', async () => {
  const supabase = createMockSupabase({ profileMissing: true });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, null);
  assertEquals(result.isSuperAdmin, false);
});

Deno.test('resolveOrganizationId: detects super admin from profile', async () => {
  const supabase = createMockSupabase({
    profileOrgId: 'org-1',
    isSuperAdmin: true,
  });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.isSuperAdmin, true);
});

Deno.test('resolveOrganizationId: non-super-admin flag', async () => {
  const supabase = createMockSupabase({
    profileOrgId: 'org-1',
    isSuperAdmin: false,
  });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.isSuperAdmin, false);
});

Deno.test('resolveOrganizationId: requestedOrgId overrides profile org even for super admin', async () => {
  const supabase = createMockSupabase({
    profileOrgId: 'admin-org',
    isSuperAdmin: true,
  });
  const result = await resolveOrganizationId(supabase, 'user-1', 'target-org');
  assertEquals(result.organizationId, 'target-org');
  assertEquals(result.isSuperAdmin, true);
});

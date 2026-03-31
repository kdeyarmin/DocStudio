/**
 * Unit tests for AI message helpers.
 *
 * Run with:
 *   deno test supabase/functions/_shared/ai-message.test.ts
 */
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { toMessageContent, resolveOrganizationId, type OrgResolverClient } from './ai-message.ts';

// ── toMessageContent ─────────────────────────────────────────────────────────

Deno.test('toMessageContent: returns trimmed string for string input', () => {
  assertEquals(toMessageContent('  hello  '), 'hello');
});

Deno.test('toMessageContent: returns null for whitespace-only string', () => {
  assertEquals(toMessageContent('   '), null);
});

Deno.test('toMessageContent: returns null for empty string', () => {
  assertEquals(toMessageContent(''), null);
});

Deno.test('toMessageContent: returns null for undefined', () => {
  assertEquals(toMessageContent(undefined), null);
});

Deno.test('toMessageContent: returns null for null', () => {
  assertEquals(toMessageContent(null), null);
});

Deno.test('toMessageContent: returns null for number', () => {
  assertEquals(toMessageContent(42), null);
});

Deno.test('toMessageContent: extracts text from array of strings', () => {
  assertEquals(toMessageContent(['hello', 'world']), 'hello\nworld');
});

Deno.test('toMessageContent: extracts text from array of objects with text property', () => {
  assertEquals(
    toMessageContent([{ type: 'text', text: 'first' }, { type: 'text', text: 'second' }]),
    'first\nsecond',
  );
});

Deno.test('toMessageContent: filters out non-text items from array', () => {
  assertEquals(
    toMessageContent([{ type: 'image', url: 'x' }, { type: 'text', text: 'only-this' }]),
    'only-this',
  );
});

Deno.test('toMessageContent: returns null for empty array', () => {
  assertEquals(toMessageContent([]), null);
});

Deno.test('toMessageContent: handles mixed strings and objects', () => {
  assertEquals(toMessageContent(['plain', { text: 'obj' }]), 'plain\nobj');
});

// ── resolveOrganizationId ────────────────────────────────────────────────────

function mockSupabase(opts: {
  profileOrgId?: string | null;
  isSuperAdmin?: boolean;
  membershipOrgId?: string | null;
}): OrgResolverClient {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const chain = {
            eq(_col: string, _val: unknown) {
              return {
                eq(_col2: string, _val2: unknown) {
                  return {
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  };
                },
                limit(_v: number) {
                  return {
                    maybeSingle: () => {
                      if (table === 'organization_members' && opts.membershipOrgId) {
                        return Promise.resolve({ data: { organization_id: opts.membershipOrgId }, error: null });
                      }
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
                maybeSingle: () => {
                  if (table === 'profiles') {
                    return Promise.resolve({
                      data: {
                        organization_id: opts.profileOrgId ?? null,
                        is_super_admin: opts.isSuperAdmin ?? false,
                      },
                      error: null,
                    });
                  }
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
            limit(_v: number) {
              return {
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              };
            },
          };
          return chain;
        },
      };
    },
  };
}

Deno.test('resolveOrganizationId: returns requested org when provided', async () => {
  const supabase = mockSupabase({ profileOrgId: 'profile-org' });
  const result = await resolveOrganizationId(supabase, 'user-1', 'requested-org');
  assertEquals(result.organizationId, 'requested-org');
});

Deno.test('resolveOrganizationId: falls back to profile org when no requested org', async () => {
  const supabase = mockSupabase({ profileOrgId: 'profile-org' });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, 'profile-org');
});

Deno.test('resolveOrganizationId: falls back to membership org when profile has none', async () => {
  const supabase = mockSupabase({ profileOrgId: null, membershipOrgId: 'member-org' });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, 'member-org');
});

Deno.test('resolveOrganizationId: returns null when no org found anywhere', async () => {
  const supabase = mockSupabase({ profileOrgId: null, membershipOrgId: null });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.organizationId, null);
});

Deno.test('resolveOrganizationId: detects super admin from profile', async () => {
  const supabase = mockSupabase({ profileOrgId: 'org', isSuperAdmin: true });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.isSuperAdmin, true);
});

Deno.test('resolveOrganizationId: non-super-admin flagged correctly', async () => {
  const supabase = mockSupabase({ profileOrgId: 'org', isSuperAdmin: false });
  const result = await resolveOrganizationId(supabase, 'user-1');
  assertEquals(result.isSuperAdmin, false);
});

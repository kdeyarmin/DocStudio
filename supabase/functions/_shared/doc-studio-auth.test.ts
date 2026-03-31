/**
 * Unit tests for shared Documentation Studio auth helpers.
 *
 * Run with:
 *   deno test --allow-none supabase/functions/_shared/doc-studio-auth.test.ts
 */
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createDocStudioAccessResolver,
  type MembershipVerifier,
  type TableLikeClient,
} from './doc-studio-auth.ts';

type QueryResult = { data: Record<string, unknown> | null; error: unknown };

function createTableClient(rows: {
  drafts?: Record<string, { organization_id?: string | null } | null>;
  jobs?: Record<string, { organization_id?: string | null; draft_id?: string | null } | null>;
  memberships?: Array<{ organization_id: string; is_active?: boolean }>;
}): TableLikeClient {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const filters = new Map<string, unknown>();
          return {
            eq(column: string, value: unknown) {
              filters.set(column, value);
              return this;
            },
            maybeSingle(): Promise<QueryResult> {
              const id = String(filters.get('id') ?? '');
              if (table === 'doc_studio_drafts') {
                return Promise.resolve({
                  data: rows.drafts?.[id] ?? null,
                  error: null,
                });
              }
              if (table === 'documentation_jobs') {
                return Promise.resolve({
                  data: rows.jobs?.[id] ?? null,
                  error: null,
                });
              }
              if (table === 'organization_members') {
                return Promise.resolve({
                  data: (rows.memberships ?? []).filter((row) => row.is_active !== false) as unknown as Record<string, unknown>,
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            },
            async then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
              if (table === 'organization_members') {
                return resolve({
                  data: (rows.memberships ?? []).filter((row) => row.is_active !== false),
                  error: null,
                });
              }
              return resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
}

function createMembershipVerifier(allowedOrgIds: Set<string>): MembershipVerifier {
  return async (_userId, organizationId) => {
    const allowed = allowedOrgIds.has(organizationId);
    return allowed ? { allowed: true } : { allowed: false, status: 403 };
  };
}

Deno.test('resolveDraftOrganizationId returns the draft organization', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({
      drafts: {
        draft_1: { organization_id: 'org_1' },
      },
    }),
    createMembershipVerifier(new Set()),
    'user_1',
  );

  assertEquals(await resolver.resolveDraftOrganizationId('draft_1'), 'org_1');
});

Deno.test('resolveJobOrganizationId prefers the job organization_id', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({
      jobs: {
        job_1: { organization_id: 'org_1', draft_id: 'draft_1' },
      },
      drafts: {
        draft_1: { organization_id: 'org_2' },
      },
    }),
    createMembershipVerifier(new Set()),
    'user_1',
  );

  assertEquals(await resolver.resolveJobOrganizationId('job_1'), 'org_1');
});

Deno.test('resolveJobOrganizationId falls back to the draft organization_id', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({
      jobs: {
        job_1: { organization_id: null, draft_id: 'draft_1' },
      },
      drafts: {
        draft_1: { organization_id: 'org_2' },
      },
    }),
    createMembershipVerifier(new Set()),
    'user_1',
  );

  assertEquals(await resolver.resolveJobOrganizationId('job_1'), 'org_2');
});

Deno.test('ensureOrgAccess denies access when organization context is missing', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({}),
    createMembershipVerifier(new Set(['org_1'])),
    'user_1',
  );

  const result = await resolver.ensureOrgAccess(null);
  assertEquals(result.allowed, false);
  assertEquals(result.status, 400);
});

Deno.test('ensureOrgAccess denies access when membership verifier rejects the org', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({}),
    createMembershipVerifier(new Set(['org_1'])),
    'user_1',
  );

  const result = await resolver.ensureOrgAccess('org_2');
  assertEquals(result.allowed, false);
  assertEquals(result.status, 403);
});

Deno.test('ensureOrgAccess allows access for org members', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({}),
    createMembershipVerifier(new Set(['org_1'])),
    'user_1',
  );

  const result = await resolver.ensureOrgAccess('org_1');
  assertEquals(result.allowed, true);
  assertEquals(result.status, undefined);
});

Deno.test('resolveActiveOrganizationIds returns only active memberships', async () => {
  const resolver = createDocStudioAccessResolver(
    createTableClient({
      memberships: [
        { organization_id: 'org_1', is_active: true },
        { organization_id: 'org_2', is_active: false },
        { organization_id: 'org_3' },
      ],
    }),
    createMembershipVerifier(new Set(['org_1', 'org_3'])),
    'user_1',
  );

  assertEquals(await resolver.resolveActiveOrganizationIds(), ['org_1', 'org_3']);
});

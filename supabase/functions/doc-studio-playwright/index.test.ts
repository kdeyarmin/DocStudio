import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { AuthResult, MembershipResult } from "../_shared/auth.ts";
import { handleDocStudioPlaywrightRequest } from "./index.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type MockJob = { id: string; draft_id: string | null };
type MockDraft = { id: string; organization_id: string };

type QueryState = {
  table: string;
  filters: Map<string, unknown>;
  payload?: Record<string, unknown>;
};

function createSupabaseMock(config: {
  draftById?: Record<string, MockDraft>;
  jobById?: Record<string, MockJob>;
  settings?: Record<string, unknown>;
  insertJobId?: string;
}) {
  const draftById = config.draftById ?? {};
  const jobById = config.jobById ?? {};
  const settings = config.settings ?? { playwright_runner_url: "https://runner.example" };
  const insertJobId = config.insertJobId ?? "job-1";

  const insertedEvents: Array<Record<string, unknown>> = [];
  const updatedJobs: Array<{ id: string; updates: Record<string, unknown> }> = [];

  const resolveSelect = (state: QueryState) => {
    if (state.table === "doc_studio_drafts") {
      const id = state.filters.get("id");
      if (typeof id === "string") return draftById[id] ?? null;
    }
    if (state.table === "documentation_jobs") {
      const id = state.filters.get("id");
      if (typeof id === "string") return jobById[id] ?? null;
    }
    if (state.table === "documentation_settings") {
      const key = state.filters.get("key");
      if (key === "playwright_config") return { value_json: settings };
      return null;
    }
    if (state.table === "documentation_workflows") {
      const id = state.filters.get("id");
      return { id, name: "Test Workflow", steps: [] };
    }
    if (state.table === "documentation_demo_accounts") {
      return null;
    }
    return null;
  };

  const resolveInsertSingle = (state: QueryState) => {
    if (state.table === "documentation_jobs") {
      return { id: insertJobId };
    }
    return null;
  };

  const api = {
    from(table: string) {
      const state: QueryState = { table, filters: new Map() };
      const query = {
        select(_columns: string) {
          return query;
        },
        insert(payload: Record<string, unknown>) {
          state.payload = payload;
          if (table === "documentation_job_events") {
            insertedEvents.push(payload);
          }
          return query;
        },
        update(payload: Record<string, unknown>) {
          state.payload = payload;
          return query;
        },
        eq(column: string, value: unknown) {
          state.filters.set(column, value);
          if (table === "documentation_jobs" && state.payload) {
            const id = state.filters.get("id");
            if (typeof id === "string") {
              updatedJobs.push({ id, updates: state.payload });
            }
          }
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: resolveSelect(state), error: null });
        },
        single() {
          if (state.payload && table === "documentation_jobs") {
            const created = resolveInsertSingle(state);
            return Promise.resolve({ data: created, error: null });
          }
          return Promise.resolve({ data: resolveSelect(state), error: null });
        },
      };
      return query;
    },
  };

  return { api, insertedEvents, updatedJobs };
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return await res.json() as Record<string, unknown>;
}

function authOk(userId = "user-1"): AuthResult {
  return {
    user: {
      id: userId,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: "",
    } as unknown as AuthResult extends { user: infer U } ? U : never,
    token: "token",
  };
}

function membershipOk(): MembershipResult {
  return { membership: { id: "m-1", role: "staff" } };
}

function makeRequest(body: Record<string, unknown>, headers?: HeadersInit): Request {
  return new Request("https://example.test/doc-studio-playwright", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

function asSupabaseClientLike(
  api: ReturnType<typeof createSupabaseMock>["api"],
): SupabaseClient {
  return api as unknown as SupabaseClient;
}

Deno.test("dispatch rejects unauthenticated requests", async () => {
  const { api } = createSupabaseMock({});
  const req = makeRequest({ action: "dispatch", payload: { workflow_id: "0d57d1c2-3f7a-45f3-91fd-74284f9b7d89" } });
  const unauthorized = new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401 });

  const res = await handleDocStudioPlaywrightRequest(req, {
    createServiceClient: () => asSupabaseClientLike(api),
    requireAuth: async () => ({ error: unauthorized }),
    verifyOrgMembership: async () => membershipOk(),
    now: () => "2026-03-29T00:00:00.000Z",
    fetch: globalThis.fetch,
    waitUntil: () => {},
    env: () => undefined,
  });

  assertEquals(res.status, 401);
  const body = await parseJson(res);
  assertStringIncludes(String(body.error), "Missing authorization header");
});

Deno.test("dispatch enforces draft org membership", async () => {
  const draftId = "8cfda2bd-d8c3-4f5b-a4e5-a311f7659779";
  const { api } = createSupabaseMock({
    draftById: { [draftId]: { id: draftId, organization_id: "org-1" } },
  });
  const req = makeRequest({
    action: "dispatch",
    payload: {
      workflow_id: "0d57d1c2-3f7a-45f3-91fd-74284f9b7d89",
      draft_id: draftId,
    },
  });

  const denied = new Response(JSON.stringify({ error: "Not authorized for this organization" }), { status: 403 });
  const res = await handleDocStudioPlaywrightRequest(req, {
    createServiceClient: () => asSupabaseClientLike(api),
    requireAuth: async () => authOk(),
    verifyOrgMembership: async () => ({ error: denied }),
    now: () => "2026-03-29T00:00:00.000Z",
    fetch: globalThis.fetch,
    waitUntil: () => {},
    env: (name) => {
      if (name === "SUPABASE_URL") return "https://supabase.example";
      if (name === "PLAYWRIGHT_RUNNER_SECRET") return "runner-secret";
      if (name === "PLAYWRIGHT_CALLBACK_SECRET") return "callback-secret";
      return undefined;
    },
  });

  assertEquals(res.status, 403);
  const body = await parseJson(res);
  assertStringIncludes(String(body.error), "Not authorized");
});

Deno.test("dispatch validates workflow_id format", async () => {
  const { api } = createSupabaseMock({});
  const req = makeRequest({ action: "dispatch", payload: { workflow_id: "not-a-uuid" } });
  const res = await handleDocStudioPlaywrightRequest(req, {
    createServiceClient: () => asSupabaseClientLike(api),
    requireAuth: async () => authOk(),
    verifyOrgMembership: async () => membershipOk(),
    now: () => "2026-03-29T00:00:00.000Z",
    fetch: globalThis.fetch,
    waitUntil: () => {},
    env: () => undefined,
  });

  assertEquals(res.status, 400);
  const body = await parseJson(res);
  assertStringIncludes(String(body.error), "workflow_id");
});

Deno.test("cancel validates ownership via linked draft organization", async () => {
  const jobId = "86b2ff3f-94db-4f4d-a8a9-1ff39b415d04";
  const draftId = "f3f6e933-92be-49c3-bd84-63f6f97a9576";
  const { api } = createSupabaseMock({
    jobById: { [jobId]: { id: jobId, draft_id: draftId } },
    draftById: { [draftId]: { id: draftId, organization_id: "org-1" } },
  });
  const req = makeRequest({ action: "cancel", job_id: jobId });
  const denied = new Response(JSON.stringify({ error: "Not authorized for this organization" }), { status: 403 });

  const res = await handleDocStudioPlaywrightRequest(req, {
    createServiceClient: () => asSupabaseClientLike(api),
    requireAuth: async () => authOk(),
    verifyOrgMembership: async () => ({ error: denied }),
    now: () => "2026-03-29T00:00:00.000Z",
    fetch: globalThis.fetch,
    waitUntil: () => {},
    env: () => undefined,
  });

  assertEquals(res.status, 403);
});

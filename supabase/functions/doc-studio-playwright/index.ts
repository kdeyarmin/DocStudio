import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireAuth,
  verifyOrgMembership,
  verifyDocStudioJobAccess,
  isSuperAdminUser,
} from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";

const SETTINGS_KEY = "playwright_config";
const TERMINAL_STATUSES = new Set(["ready_for_review", "completed", "failed", "cancelled"]);

type HandlerDeps = {
  createServiceClient: () => SupabaseLike;
  requireAuth: typeof requireAuth;
  verifyOrgMembership: typeof verifyOrgMembership;
  now: () => string;
  fetch: typeof fetch;
  waitUntil: (promise: Promise<unknown>) => void;
  env: (name: string) => string | undefined;
};

type JobInsertResult = { id: string };
type JobSelectResult = { id: string; draft_id: string | null };
type SupabaseLike = ReturnType<typeof createServiceClient>;

const defaultDeps: HandlerDeps = {
  createServiceClient,
  requireAuth,
  verifyOrgMembership,
  now: () => new Date().toISOString(),
  fetch,
  waitUntil: (promise) => {
    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(promise);
      return;
    }
    void promise;
  },
  env: (name) => Deno.env.get(name),
};

async function ensureDraftAccess(
  req: Request,
  supabase: SupabaseLike,
  userId: string,
  draftId: string | null | undefined,
  deps: HandlerDeps,
): Promise<Response | null> {
  if (!draftId) return null;

  const { data: draft } = await (supabase
    .from("doc_studio_drafts")
    .select("organization_id")
    .eq("id", draftId)
    .maybeSingle() as unknown as Promise<{ data: { organization_id?: string | null } | null }>);

  if (!draft?.organization_id) {
    return jsonResponse({ error: "Draft not found" }, 404, req);
  }

  const membership = await deps.verifyOrgMembership(
    supabase,
    userId,
    String(draft.organization_id),
    req,
  );
  if ("error" in membership && membership.error) {
    return membership.error;
  }
  return null;
}

async function insertJob(
  supabase: SupabaseLike,
  values: Record<string, unknown>,
): Promise<{ data: JobInsertResult | null; error: { message?: string } | null }> {
  const result = await (supabase
    .from("documentation_jobs")
    .insert(values)
    .select("id")
    .single() as unknown as Promise<{ data: JobInsertResult | null; error: { message?: string } | null }>);
  return {
    data: (result.data ?? null) as JobInsertResult | null,
    error: result.error ? { message: result.error.message } : null,
  };
}

async function getJobById(
  supabase: SupabaseLike,
  jobId: string,
): Promise<JobSelectResult | null> {
  const result = await (supabase
    .from("documentation_jobs")
    .select("id, draft_id")
    .eq("id", jobId)
    .maybeSingle() as unknown as Promise<{ data: JobSelectResult | null }>);
  return (result.data ?? null) as JobSelectResult | null;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleDocStudioPlaywrightRequest(
  req: Request,
  deps: HandlerDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabase = deps.createServiceClient();
    const authResult = await deps.requireAuth(req, supabase);
    if (authResult.error) return authResult.error;
    const userId = authResult.user.id;

    const body = await req.json();
    const { action } = body;

    // ── Dispatch: create job record + send to external runner ─────────────────
    if (action === "dispatch") {
      const { payload } = body;
      if (!payload?.workflow_id || typeof payload.workflow_id !== "string") {
        return jsonResponse({ error: "workflow_id is required" }, 400, req);
      }
      if (!payload?.draft_id || typeof payload.draft_id !== "string") {
        return jsonResponse({ error: "draft_id is required to dispatch a job" }, 400, req);
      }

      // Resolve organization from draft
      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id")
        .eq("id", payload.draft_id)
        .maybeSingle();
      if (!draft?.organization_id) {
        return jsonResponse({ error: "Draft not found" }, 404, req);
      }
      const organizationId: string = draft.organization_id;

      // Verify caller has org membership
      const membership = await deps.verifyOrgMembership(supabase, userId, organizationId, req);
      if (membership.error) return membership.error;

      // Verify workflow exists, is active, and belongs to the org
      const { data: workflow, error: wfErr } = await supabase
        .from("documentation_workflows")
        .select("*, steps:documentation_workflow_steps(*)")
        .eq("id", payload.workflow_id)
        .single();
      if (wfErr || !workflow) {
        return jsonResponse({ error: "Workflow not found" }, 404, req);
      }

      // Load Playwright settings
      const { data: settingsRow } = await (supabase
        .from("documentation_settings")
        .select("value_json")
        .eq("organization_id", organizationId)
        .eq("key", SETTINGS_KEY)
        .maybeSingle() as unknown as Promise<{ data: { value_json?: Record<string, unknown> } | null }>);

      const settings = settingsRow?.value_json ?? {};
      const runnerUrl: string = (settings as Record<string, unknown>).playwright_runner_url as string ?? "";
      if (!runnerUrl) {
        return jsonResponse({ error: "Playwright runner URL not configured in settings." }, 503, req);
      }

      const runnerSecret = deps.env("PLAYWRIGHT_RUNNER_SECRET");
      if (!runnerSecret) {
        return jsonResponse({ error: "Playwright runner secret not configured" }, 503, req);
      }

      const supabaseUrl = deps.env("SUPABASE_URL");
      if (!supabaseUrl) {
        return jsonResponse({ error: "SUPABASE_URL not configured" }, 500, req);
      }

      const callbackToken = deps.env("PLAYWRIGHT_CALLBACK_SECRET") ?? deps.env("SUPABASE_ANON_KEY") ?? "";
      if (!callbackToken) {
        return jsonResponse({ error: "PLAYWRIGHT_CALLBACK_SECRET or SUPABASE_ANON_KEY required" }, 500, req);
      }

      const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");

      // Load demo account if provided
      let demoAccount = null;
      if (payload.demo_account_id) {
        const { data } = await (supabase
          .from("documentation_demo_accounts")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("id", payload.demo_account_id)
          .maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null }>);
        demoAccount = data;
      }

      // Create the job record
      const now = deps.now();
      const { data: job, error: jobErr } = insertJob(supabase, {
        organization_id: organizationId,
        workflow_id: payload.workflow_id,
        draft_id: payload.draft_id,
        provider_mode: "playwright",
        status: "queued",
        selected_demo_account_id: payload.demo_account_id ?? null,
        version_label: payload.version_label ?? null,
        custom_title: payload.custom_title ?? null,
        created_by: userId,
        notes: payload.notes ?? null,
        output_type: payload.output_type ?? "full_package",
        environment: payload.environment ?? "demo",
        metadata_json: {},
        execution_summary_json: {},
        step_results_json: [],
        logs_json: {},
        created_at: now,
        updated_at: now,
      }) as unknown as { data: JobInsertResult | null; error: { message?: string } | null };
      if (jobErr || !job) throw new Error(jobErr?.message ?? "Failed to create job");

      // Link draft to the new job
      if (payload.draft_id) {
        const { error: draftLinkErr } = await supabase
          .from("doc_studio_drafts")
          .update({ latest_doc_job_id: job.id, updated_at: now })
          .eq("id", payload.draft_id);
        if (draftLinkErr) {
          console.error("[doc-studio-playwright] Failed to link draft to job:", draftLinkErr.message);
        }
      }

      // Write initial event
      const { error: evtErr } = await (supabase.from("documentation_job_events").insert({
        job_id: job.id,
        event_type: "provider_resolved",
        title: "Provider Resolved",
        description: "Playwright automation provider selected.",
        severity: "info",
        payload_json: { provider: "playwright" },
      }) as unknown as Promise<{ error: { message?: string } | null }>);
      if (evtErr) console.error("[doc-studio-playwright] Failed to insert event:", evtErr.message);

      // Dispatch to runner — fire and forget (runner posts back via runner_callback)
      const callbackUrl = `${supabaseUrl}/functions/v1/doc-studio-jobs`;
      deps.waitUntil(
        deps.fetch(`${runnerUrl}/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${runnerSecret}`,
          },
          body: JSON.stringify({
            job_id: job.id,
            workflow,
            demo_account: demoAccount,
            settings,
            callback_url: callbackUrl,
            callback_token: callbackToken,
            supabase_key: serviceRoleKey,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            await (supabase
              .from("documentation_jobs")
              .update({
                status: "failed",
                error_message: `Runner rejected job: ${text}`,
                updated_at: deps.now(),
              })
              .eq("id", job.id) as unknown as Promise<{ error: { message?: string } | null }>);
            const { error: failEvtErr } = await (supabase.from("documentation_job_events").insert({
              job_id: job.id,
              event_type: "workflow_failed",
              title: "Dispatch Failed",
              description: `Runner returned ${res.status}: ${text}`,
              severity: "error",
              payload_json: { status: res.status },
            }) as unknown as Promise<{ error: { message?: string } | null }>);
            if (failEvtErr) console.error("[doc-studio-playwright] Failed to insert fail event:", failEvtErr.message);
          }
        }).catch(async (err: unknown) => {
          await (supabase
            .from("documentation_jobs")
            .update({
              status: "failed",
              error_message: `Failed to reach runner: ${err instanceof Error ? err.message : String(err)}`,
              updated_at: deps.now(),
            })
            .eq("id", job.id) as unknown as Promise<{ error: { message?: string } | null }>);
        })
      );

      return jsonResponse({ job_id: job.id }, 200, req);
    }

    // ── Cancel: forward cancel to runner if needed ────────────────────────────
    if (action === "cancel") {
      const { job_id } = body;
      if (!job_id || typeof job_id !== "string") {
        return jsonResponse({ error: "job_id is required" }, 400, req);
      }

      // Verify the user can access this job
      const jobAccess = await verifyDocStudioJobAccess(supabase, userId, job_id, req);
      if (jobAccess.error) return jobAccess.error;

      // Ensure user has org membership via draft if applicable
      const draftAccessError = await ensureDraftAccess(req, supabase, userId, jobAccess.job.draft_id, deps);
      if (draftAccessError) return draftAccessError;

      // Check terminal status
      const { data: jobRow, error: jobErr } = await supabase
        .from("documentation_jobs")
        .select("status")
        .eq("id", job_id)
        .maybeSingle();
      if (jobErr) throw jobErr;
      if (!jobRow) {
        return jsonResponse({ error: "Job not found" }, 404, req);
      }
      if (TERMINAL_STATUSES.has(jobRow.status)) {
        return jsonResponse({ error: "Job already in terminal state" }, 400, req);
      }

      // Resolve org for settings lookup
      const selectedJob = await getJobById(supabase, job_id);
      let settingsOrgId: string | null = null;
      if (selectedJob?.draft_id) {
        const { data: draftRow } = await supabase
          .from("doc_studio_drafts")
          .select("organization_id")
          .eq("id", selectedJob.draft_id)
          .maybeSingle();
        settingsOrgId = draftRow?.organization_id ?? null;
      }

      // Update DB immediately
      const now = deps.now();
      await (supabase
        .from("documentation_jobs")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", job_id) as unknown as Promise<{ error: { message?: string } | null }>);

      const { error: cancelEvtErr } = await (supabase.from("documentation_job_events").insert({
        job_id,
        event_type: "job_cancelled",
        title: "Job Cancelled",
        description: "Run was cancelled by user.",
        severity: "warning",
        payload_json: {},
      }) as unknown as Promise<{ error: { message?: string } | null }>);
      if (cancelEvtErr) console.error("[doc-studio-playwright] Failed to insert cancel event:", cancelEvtErr.message);

      // Best-effort cancel on runner
      if (settingsOrgId) {
        const { data: settingsRow } = await (supabase
          .from("documentation_settings")
          .select("value_json")
          .eq("organization_id", settingsOrgId)
          .eq("key", SETTINGS_KEY)
          .maybeSingle() as unknown as Promise<{ data: { value_json?: Record<string, unknown> } | null }>);

        const settings = settingsRow?.value_json ?? {};
        const runnerUrl: string = (settings as Record<string, unknown>).playwright_runner_url as string ?? "";
        const cancelSecret = deps.env("PLAYWRIGHT_RUNNER_SECRET");
        if (runnerUrl && cancelSecret) {
          deps.waitUntil(
            deps.fetch(`${runnerUrl}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${cancelSecret}`,
              },
              body: JSON.stringify({ job_id }),
            }).catch(() => {/* ignore */})
          );
        }
      }

      return jsonResponse({ success: true }, 200, req);
    }

    return jsonResponse({ error: "Unknown action" }, 400, req);
  } catch (err) {
    console.error('[doc-studio-playwright] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: "Internal server error" }, 500, req);
  }
}

if (import.meta.main) {
  Deno.serve((req: Request) => handleDocStudioPlaywrightRequest(req));
}

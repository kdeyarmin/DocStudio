import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createServiceClient,
  requireAuth,
  getAuthorizedDocStudioJobAccess,
  verifyDocStudioJobAccess,
} from "../_shared/auth.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";
import { createDocStudioAccessVerifier } from "../_shared/doc-studio-auth.ts";

function json(data: unknown, status = 200, req?: Request) {
  return jsonResponse(data as Record<string, unknown>, status, req);
}

const TERMINAL_STATUSES = ["ready_for_review", "completed", "failed", "cancelled"];
const RUNNER_CALLBACK_SECRET_ENV = "DOC_STUDIO_RUNNER_CALLBACK_SECRET";

function getRunnerCallbackSecret(): string {
  const secret = Deno.env.get(RUNNER_CALLBACK_SECRET_ENV)?.trim();
  if (!secret) {
    throw new Error(`${RUNNER_CALLBACK_SECRET_ENV} must be configured`);
  }

  return secret;
}

function hasRunnerCallbackAuthorization(req: Request, expectedSecret: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!/^bearer\s+/i.test(authHeader)) {
    return false;
  }

  return authHeader.replace(/^bearer\s+/i, "").trim() === expectedSecret;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { action } = body;
    const bodyOrgId =
      (typeof body.organization_id === "string" && body.organization_id.trim()) ||
      (typeof body.organizationId === "string" && body.organizationId.trim()) ||
      null;
    const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 50;

    const isRunnerCallback = action === "runner_callback";
    let authenticatedUserId: string | null = null;

    if (isRunnerCallback) {
      const callbackSecret = getRunnerCallbackSecret();
      if (!hasRunnerCallbackAuthorization(req, callbackSecret)) {
        return jsonResponse({ error: "Unauthorized runner callback" }, 401, req);
      }
    } else {
      const authResult = await requireAuth(req, supabase);
      if (authResult.error) return authResult.error;
      authenticatedUserId = authResult.user.id;
    }

    if (action === "list") {
      const authorizedAccess = await getAuthorizedDocStudioJobAccess(
        supabase,
        authenticatedUserId!,
        req,
      );
      if (authorizedAccess.error) return authorizedAccess.error;

      let q = supabase
        .from("documentation_jobs")
        .select("*, workflow:documentation_workflows(id,name,slug)")
        .eq("organization_id", bodyOrgId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (body.workflow_id) q = q.eq("workflow_id", body.workflow_id);
      if (body.draft_id) q = q.eq("draft_id", body.draft_id);
      if (body.status && body.status !== "all") q = q.eq("status", body.status);

      const { data, error } = await q;
      if (error) throw error;
      const allowedDraftIds = new Set(authorizedAccess.draftIds);
      const allowedJobIds = new Set(authorizedAccess.jobIds);
      const jobs = (data ?? []).filter((job) => {
        if (job?.draft_id) {
          return typeof job.draft_id === "string" && allowedDraftIds.has(job.draft_id);
        }

        return typeof job?.id === "string" && allowedJobIds.has(job.id);
      });
      return json({ jobs });
    }

    if (action === "get") {
      const jobAccess = await verifyDocStudioJobAccess(supabase, authenticatedUserId!, body.job_id, req);
      if (jobAccess.error) return jobAccess.error;
      const { data, error } = await supabase
        .from("documentation_jobs")
        .select(`
          *,
          workflow:documentation_workflows(id, name, slug, start_url),
          demo_account:documentation_demo_accounts(id, name, environment, role)
        `)
        .eq("id", body.job_id)
        .single();
      if (error) throw error;
      return json({ job: data }, 200, req);
    }

    if (action === "get_events") {
      const jobAccess = await verifyDocStudioJobAccess(supabase, authenticatedUserId!, body.job_id, req);
      if (jobAccess.error) return jobAccess.error;
      const { data, error } = await supabase
        .from("documentation_job_events")
        .select("*")
        .eq("job_id", body.job_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ events: data ?? [] }, 200, req);
    }

    if (action === "get_assets") {
      const jobAccess = await verifyDocStudioJobAccess(supabase, authenticatedUserId!, body.job_id, req);
      if (jobAccess.error) return jobAccess.error;
      const { data, error } = await supabase
        .from("documentation_assets")
        .select("*")
        .eq("job_id", body.job_id)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      const normalizedAssets = (data ?? []).map((asset) => ({
        ...asset,
        file_path: asset.storage_path ?? null,
        file_url: asset.public_url ?? null,
        file_size: asset.file_size_bytes ?? null,
        caption: asset.checkpoint_type ?? null,
        is_cover: asset.is_cover_candidate ?? false,
        updated_at: asset.created_at,
      }));

      return json({ assets: normalizedAssets });
    }

    if (action === "cancel") {
      const jobAccess = await verifyDocStudioJobAccess(supabase, authenticatedUserId!, body.job_id, req);
      if (jobAccess.error) return jobAccess.error;
      const { data: job } = await supabase
        .from("documentation_jobs")
        .select("status")
        .eq("id", body.job_id)
        .eq("organization_id", bodyOrgId)
        .single();

      if (job && TERMINAL_STATUSES.includes(job.status)) {
        return jsonResponse({ error: "Job already in terminal state" }, 400, req);
      }

      const { error } = await supabase
        .from("documentation_jobs")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", body.job_id)
        .eq("organization_id", bodyOrgId);
      if (error) throw error;

      const { data: latestJob, error: latestJobErr } = await supabase
        .from("documentation_jobs")
        .select("status")
        .eq("id", job.id)
        .maybeSingle();
      if (latestJobErr) throw latestJobErr;

      if (latestJob?.status === "cancelled") {
        const { data: existingCancelEvent, error: existingCancelEventErr } = await supabase
          .from("documentation_job_events")
          .select("id")
          .eq("job_id", job.id)
          .eq("event_type", "job_cancelled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingCancelEventErr) throw existingCancelEventErr;

        if (!existingCancelEvent) {
          const { error: eventErr } = await supabase.from("documentation_job_events").insert({
            job_id: job.id,
            event_type: "job_cancelled",
            title: "Job Cancelled",
            description: "Run was cancelled by user.",
            severity: "warning",
            payload_json: {},
          });
          if (eventErr) console.error("Failed to log job cancellation event:", eventErr.message);
        }
      }

      return json({ success: true }, 200, req);
    }

    if (action === "complete") {
      const jobAccess = await verifyDocStudioJobAccess(supabase, authenticatedUserId!, body.job_id, req);
      if (jobAccess.error) return jobAccess.error;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("documentation_jobs")
        .update({ status: "completed", completed_at: now, updated_at: now })
        .eq("id", body.job_id)
        .eq("organization_id", bodyOrgId);
      if (error) throw error;

      if (jobAccess.job.draft_id) {
        await supabase
          .from("doc_studio_drafts")
          .update({ status: "completed", updated_at: now })
          .eq("id", jobAccess.job.draft_id);
      }

      return json({ success: true }, 200, req);
    }

    // Called by the Playwright runner to post results back (auth already verified above)
    if (action === "runner_callback") {
      const { job_id, status, step_results, execution_summary, error_message, asset_count } = body;
      const now = new Date().toISOString();

      const baseUpdates: Record<string, unknown> = {
        updated_at: now,
        execution_summary_json: execution_summary,
        step_results_json: step_results,
      };
      if (error_message) baseUpdates.error_message = error_message;
      if (asset_count !== undefined) baseUpdates.asset_count = asset_count;
      if (body.completed_step_count !== undefined) {
        baseUpdates.completed_step_count = body.completed_step_count;
      }

      const persistEvents = async () => {
        if (body.events && Array.isArray(body.events) && body.events.length > 0) {
          const { error: evtErr } = await supabase.from("documentation_job_events").insert(
            body.events.map((e: Record<string, unknown>) => ({ ...e, job_id }))
          );
          if (evtErr) console.error("Failed to persist job events:", evtErr.message);
        }
      };

      // Terminal failure, manual handoff, or cancellation — store and exit
      if (status === "failed" || status === "cancelled" || status === "needs_manual_step") {
        const { error } = await supabase
          .from("documentation_jobs")
          .update({ ...baseUpdates, status, completed_at: now })
          .eq("id", job_id)
          .eq("organization_id", bodyOrgId);
        if (error) throw error;
        await persistEvents();
        return json({ success: true }, 200, req);
      }

      // Successful run completion — store results and kick off post-processing pipeline
      if (status === "ready_for_review") {
        const { error } = await supabase
          .from("documentation_jobs")
          .update({ ...baseUpdates, status: "scene_assembly" })
          .eq("id", job_id)
          .eq("organization_id", bodyOrgId);
        if (error) throw error;
        await persistEvents();

        EdgeRuntime.waitUntil(runPostProcessingPipeline(supabase, job_id));
        return json({ success: true }, 200, req);
      }

      // Intermediate progress ping — update step results and current status
      const { error } = await supabase
        .from("documentation_jobs")
        .update({ ...baseUpdates, status })
        .eq("id", job_id)
        .eq("organization_id", bodyOrgId);
      if (error) throw error;
      await persistEvents();

      return json({ success: true }, 200, req);
    }

    return jsonResponse({ error: "Unknown action" }, 400, req);
  } catch (err) {
    console.error('[doc-studio-jobs] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: 'Internal server error' }, 500, req);
  }
});

async function runPostProcessingPipeline(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const setStatus = async (status: string) => {
    await supabase
      .from("documentation_jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  };

  const addEvent = async (
    eventType: string,
    title: string,
    description: string,
    severity: "info" | "success" | "warning" | "error",
    payloadJson: Record<string, unknown> = {},
  ) => {
    const { error: logErr } = await supabase.from("documentation_job_events").insert({
      job_id: jobId,
      event_type: eventType,
      title,
      description,
      severity,
      payload_json: payloadJson,
      created_at: new Date().toISOString(),
    });
    if (logErr) console.error("Failed to log job event:", logErr.message);
  };

  const callFn = async (
    slug: string,
    fnBody: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(fnBody),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error ?? `${slug} returned ${res.status}`);
    }
    return data;
  };

  // Resolve draft_id from the job record
  const { data: job } = await supabase
    .from("documentation_jobs")
    .select("draft_id")
    .eq("id", jobId)
    .maybeSingle();

  const draftId = job?.draft_id as string | null;

  if (!draftId) {
    await addEvent("pipeline_error", "Pipeline Skipped", "No draft_id found on job — skipping post-processing.", "warning");
    await setStatus("ready_for_review");
    await supabase
      .from("documentation_jobs")
      .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    return;
  }

  // ── Stage 1: Scene Assembly ──────────────────────────────────────────────
  await addEvent("pipeline_stage", "Assembling Scenes", "Grouping captured steps into instructional scenes.", "info");
  try {
    const sceneResult = await callFn("doc-studio-scene-assembly", { job_id: jobId, draft_id: draftId });
    await addEvent(
      "pipeline_stage",
      "Scenes Assembled",
      `${sceneResult.scene_count ?? 0} scene(s) created using ${sceneResult.grouping_mode ?? "auto"} mode.`,
      "success",
      { scene_count: sceneResult.scene_count, grouping_mode: sceneResult.grouping_mode },
    );
  } catch (err) {
    await addEvent(
      "pipeline_error",
      "Scene Assembly Failed",
      err instanceof Error ? err.message : String(err),
      "warning",
    );
  }

  // ── Stage 2: Narration Generation ────────────────────────────────────────
  await setStatus("generating_narration");
  await addEvent("pipeline_stage", "Generating Narration", "Creating AI narration segments for each scene.", "info");
  try {
    const narrationResult = await callFn("doc-studio-narration-segments", {
      action: "generate_for_job",
      job_id: jobId,
      draft_id: draftId,
    });
    const skipped = narrationResult.skipped_reason as string | undefined;
    if (skipped) {
      await addEvent(
        "pipeline_stage",
        "Narration Skipped",
        skipped === "narration_disabled" ? "Narration is disabled in settings." : "No scenes to narrate.",
        "info",
        { skipped_reason: skipped },
      );
    } else {
      await addEvent(
        "pipeline_stage",
        "Narration Generated",
        `${narrationResult.count ?? 0} segment(s) created${narrationResult.ai_used ? " with AI assistance" : ""}.`,
        "success",
        { segment_count: narrationResult.count, ai_used: narrationResult.ai_used },
      );
    }
  } catch (err) {
    await addEvent(
      "pipeline_error",
      "Narration Generation Failed",
      err instanceof Error ? err.message : String(err),
      "warning",
    );
  }

  // ── Stage 3: Quality Scoring ─────────────────────────────────────────────
  await setStatus("quality_scoring");
  await addEvent("pipeline_stage", "Scoring Quality", "Calculating documentation quality score.", "info");
  try {
    const qualityResult = await callFn("doc-studio-quality", {
      action: "calculate",
      draft_id: draftId,
    });
    const qs = qualityResult.quality_score as Record<string, unknown> | null;
    const overallScore = qs?.overall_score ?? null;
    const qualityTier = qs?.quality_tier ?? null;
    await addEvent(
      "pipeline_stage",
      "Quality Score Ready",
      overallScore != null
        ? `Overall score: ${overallScore} (${qualityTier ?? "unrated"})`
        : "Quality score calculated.",
      "success",
      { overall_score: overallScore, quality_tier: qualityTier },
    );
  } catch (err) {
    await addEvent(
      "pipeline_error",
      "Quality Scoring Failed",
      err instanceof Error ? err.message : String(err),
      "warning",
    );
  }

  // ── Finalize ─────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  await supabase
    .from("documentation_jobs")
    .update({ status: "ready_for_review", completed_at: now, updated_at: now })
    .eq("id", jobId);

  await addEvent(
    "job_ready",
    "Ready for Review",
    "Post-processing complete. Documentation is ready to review.",
    "success",
  );
}

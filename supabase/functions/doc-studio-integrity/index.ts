import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireSuperAdmin } from "../_shared/auth.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";

const ENGINE_VERSION = "1.0.0";

type IntegrityStatus = "healthy" | "warning" | "needs_review" | "needs_recapture" | "failed_validation" | "incomplete" | "unknown";
type IntegrityCategory = "capture" | "content" | "narration" | "screenshot" | "scenes" | "shot_plans" | "captions" | "render" | "drift";

interface CategoryResult {
  category: IntegrityCategory;
  score: number;
  status: IntegrityStatus;
  warnings: string[];
  failures: string[];
  recommendations: string[];
  checks: Array<{ name: string; status: "pass" | "warn" | "fail" | "skip"; detail: string | null; score: number }>;
  blocking_failure: boolean;
}

function scoreToStatus(score: number, hasBlockingFailure: boolean): IntegrityStatus {
  if (hasBlockingFailure) return "failed_validation";
  if (score >= 90) return "healthy";
  if (score >= 75) return "warning";
  if (score >= 50) return "needs_review";
  if (score >= 25) return "needs_recapture";
  return "incomplete";
}

function overallStatus(results: CategoryResult[]): { status: IntegrityStatus; score: number } {
  const scores = results.map((r) => r.score);
  const hasBlocker = results.some((r) => r.blocking_failure);
  if (scores.length === 0) return { status: "unknown", score: 0 };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { status: scoreToStatus(Math.round(avg), hasBlocker), score: Math.round(avg) };
}

function meanScore(checks: Array<{ score: number }>): number {
  if (!checks.length) return 100;
  return Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length);
}

function checkCapture(draft: Record<string, unknown>): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  const lastCapture = draft.last_captured_at as string | null;
  if (!lastCapture) {
    checks.push({ name: "capture_exists", status: "fail", detail: "No capture recorded", score: 0 });
    failures.push("Draft has never been captured");
  } else {
    const daysSince = (Date.now() - new Date(lastCapture).getTime()) / 86400000;
    if (daysSince > 30) {
      checks.push({ name: "capture_freshness", status: "fail", detail: `Captured ${Math.round(daysSince)}d ago`, score: 0 });
      failures.push(`Capture is ${Math.round(daysSince)} days old`);
      recommendations.push("Re-run Playwright capture to refresh screenshots");
    } else if (daysSince > 7) {
      checks.push({ name: "capture_freshness", status: "warn", detail: `Captured ${Math.round(daysSince)}d ago`, score: 60 });
      warnings.push(`Capture is ${Math.round(daysSince)} days old`);
    } else {
      checks.push({ name: "capture_freshness", status: "pass", detail: `Captured ${Math.round(daysSince)}d ago`, score: 100 });
    }
  }

  const providerMode = draft.provider_mode as string | null;
  if (providerMode === "mock") {
    checks.push({ name: "provider_mode", status: "warn", detail: "Running in mock mode", score: 60 });
    warnings.push("Capture used mock provider — screenshots may not reflect real UI");
  } else {
    checks.push({ name: "provider_mode", status: "pass", detail: providerMode ?? "real", score: 100 });
  }

  const score = meanScore(checks);
  return {
    category: "capture",
    score,
    status: scoreToStatus(score, failures.length > 0 && score === 0),
    warnings,
    failures,
    recommendations,
    checks,
    blocking_failure: false,
  };
}

function checkContent(draft: Record<string, unknown>): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  const title = draft.title as string | null;
  if (!title || title.trim().length < 3) {
    checks.push({ name: "title", status: "fail", detail: "Title missing or too short", score: 0 });
    failures.push("Draft title is missing");
  } else {
    checks.push({ name: "title", status: "pass", detail: title, score: 100 });
  }

  const generatedContent = draft.generated_content as Record<string, unknown> | null;
  const guideMarkdown = generatedContent?.guide_md as string | null;
  if (!guideMarkdown || guideMarkdown.length < 100) {
    checks.push({ name: "guide_content", status: "fail", detail: "Guide markdown missing or too short", score: 0 });
    failures.push("Generated guide content is missing");
    recommendations.push("Run AI content generation to produce guide markdown");
  } else {
    checks.push({ name: "guide_content", status: "pass", detail: `${guideMarkdown.length} chars`, score: 100 });
  }

  const transcript = generatedContent?.transcript as string | null;
  if (!transcript || transcript.length < 50) {
    checks.push({ name: "transcript", status: "warn", detail: "Transcript missing or short", score: 50 });
    warnings.push("Transcript is missing or very short");
  } else {
    checks.push({ name: "transcript", status: "pass", detail: `${transcript.length} chars`, score: 100 });
  }

  const completenessScore = draft.completeness_score as number | null;
  if (completenessScore === null) {
    checks.push({ name: "completeness_score", status: "warn", detail: "Not calculated", score: 50 });
    warnings.push("Completeness score has not been calculated");
  } else if (completenessScore < 60) {
    checks.push({ name: "completeness_score", status: "fail", detail: `Score: ${completenessScore}`, score: completenessScore });
    failures.push(`Low completeness score: ${completenessScore}/100`);
  } else {
    checks.push({ name: "completeness_score", status: "pass", detail: `Score: ${completenessScore}`, score: 100 });
  }

  const score = meanScore(checks);
  return { category: "content", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

function checkNarration(segments: unknown[]): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  if (!segments.length) {
    checks.push({ name: "segments_exist", status: "fail", detail: "No narration segments", score: 0 });
    failures.push("No narration segments found");
    recommendations.push("Generate narration segments from draft content");
    return { category: "narration", score: 0, status: "failed_validation", warnings, failures, recommendations, checks, blocking_failure: false };
  }

  const readyCount = segments.filter((s) => (s as Record<string, unknown>).status === "ready").length;
  const coverage = Math.round((readyCount / segments.length) * 100);
  if (coverage < 80) {
    checks.push({ name: "narration_coverage", status: coverage < 50 ? "fail" : "warn", detail: `${readyCount}/${segments.length} ready`, score: coverage });
    if (coverage < 50) failures.push(`Only ${coverage}% of narration segments are ready`);
    else warnings.push(`${100 - coverage}% of narration segments not yet ready`);
  } else {
    checks.push({ name: "narration_coverage", status: "pass", detail: `${readyCount}/${segments.length} ready`, score: 100 });
  }

  const pendingCount = segments.filter((s) => (s as Record<string, unknown>).status === "generating").length;
  if (pendingCount > 0) {
    checks.push({ name: "no_pending_jobs", status: "warn", detail: `${pendingCount} generating`, score: 70 });
    warnings.push(`${pendingCount} narration segments still generating`);
  } else {
    checks.push({ name: "no_pending_jobs", status: "pass", detail: "None pending", score: 100 });
  }

  const score = meanScore(checks);
  return { category: "narration", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

function checkScreenshots(assets: unknown[]): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  const screenshots = assets.filter((a) => (a as Record<string, unknown>).asset_type === "screenshot");

  if (!screenshots.length) {
    checks.push({ name: "screenshots_exist", status: "fail", detail: "No screenshots found", score: 0 });
    failures.push("No screenshots found");
    return { category: "screenshot", score: 0, status: "needs_recapture", warnings, failures, recommendations, checks, blocking_failure: false };
  }

  checks.push({ name: "screenshots_exist", status: "pass", detail: `${screenshots.length} found`, score: 100 });

  const readyShots = screenshots.filter((a) => (a as Record<string, unknown>).status === "ready");
  const coverage = Math.round((readyShots.length / screenshots.length) * 100);
  if (coverage < 100) {
    checks.push({ name: "all_ready", status: coverage < 80 ? "fail" : "warn", detail: `${readyShots.length}/${screenshots.length} ready`, score: coverage });
    if (coverage < 80) failures.push("Majority of screenshots not ready");
    else warnings.push("Some screenshots not yet ready");
  } else {
    checks.push({ name: "all_ready", status: "pass", detail: "All ready", score: 100 });
  }

  const lowResShots = readyShots.filter((a) => {
    const meta = (a as Record<string, unknown>).metadata_json as Record<string, unknown> | null;
    const w = meta?.width as number | null;
    const h = meta?.height as number | null;
    return w !== null && h !== null && (w < 800 || h < 450);
  });
  if (lowResShots.length > 0) {
    checks.push({ name: "resolution", status: "warn", detail: `${lowResShots.length} low-res screenshots`, score: 70 });
    warnings.push(`${lowResShots.length} screenshots below 800x450`);
    recommendations.push("Re-capture at higher viewport resolution");
  } else {
    checks.push({ name: "resolution", status: "pass", detail: "All meet minimum resolution", score: 100 });
  }

  const score = meanScore(checks);
  return { category: "screenshot", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

function checkScenes(scenes: unknown[]): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];
  const blockingFailure = false;

  if (!scenes.length) {
    checks.push({ name: "scenes_exist", status: "fail", detail: "No scenes", score: 0 });
    failures.push("No scenes found — draft cannot be rendered");
    recommendations.push("Run Playwright capture to generate scenes");
    return { category: "scenes", score: 0, status: "failed_validation", warnings, failures, recommendations, checks, blocking_failure: true };
  }

  checks.push({ name: "scenes_exist", status: "pass", detail: `${scenes.length} scenes`, score: 100 });

  const untitled = scenes.filter((s) => !(s as Record<string, unknown>).title || ((s as Record<string, unknown>).title as string).trim().length < 2);
  if (untitled.length > 0) {
    checks.push({ name: "all_titled", status: "warn", detail: `${untitled.length} untitled scenes`, score: 70 });
    warnings.push(`${untitled.length} scenes have missing or empty titles`);
  } else {
    checks.push({ name: "all_titled", status: "pass", detail: "All titled", score: 100 });
  }

  const noDuration = scenes.filter((s) => {
    const r = s as Record<string, unknown>;
    const duration = (r.end_time_seconds as number ?? 0) - (r.start_time_seconds as number ?? 0);
    return duration <= 0;
  });
  if (noDuration.length > 0) {
    checks.push({ name: "all_have_duration", status: "warn", detail: `${noDuration.length} zero-duration scenes`, score: 60 });
    warnings.push(`${noDuration.length} scenes have no duration`);
  } else {
    checks.push({ name: "all_have_duration", status: "pass", detail: "All have duration", score: 100 });
  }

  const score = meanScore(checks);
  return { category: "scenes", score, status: scoreToStatus(score, blockingFailure), warnings, failures, recommendations, checks, blocking_failure: blockingFailure };
}

function checkShotPlans(shotPlans: unknown[], scenes: unknown[]): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  if (!shotPlans.length) {
    checks.push({ name: "shot_plans_exist", status: "warn", detail: "No shot plans", score: 0 });
    warnings.push("No shot plans found");
    recommendations.push("Generate shot plans from the Shot Plans tab");
    return { category: "shot_plans", score: 0, status: "needs_review", warnings, failures, recommendations, checks, blocking_failure: false };
  }

  checks.push({ name: "shot_plans_exist", status: "pass", detail: `${shotPlans.length} plans`, score: 100 });

  if (scenes.length > 0) {
    const coveredSceneIds = new Set(
      shotPlans
        .map((p) => (p as Record<string, unknown>).scene_id as string | null)
        .filter(Boolean),
    );
    const coverage = Math.round((coveredSceneIds.size / scenes.length) * 100);
    if (coverage < 80) {
      checks.push({ name: "scene_coverage", status: "warn", detail: `${coverage}% scenes covered`, score: coverage });
      warnings.push(`Only ${coverage}% of scenes have shot plans`);
    } else {
      checks.push({ name: "scene_coverage", status: "pass", detail: `${coverage}% scenes covered`, score: 100 });
    }
  }

  const keyShots = shotPlans.filter((p) => (p as Record<string, unknown>).is_key_shot);
  if (!keyShots.length) {
    checks.push({ name: "key_shots_tagged", status: "warn", detail: "No key shots tagged", score: 60 });
    warnings.push("No key shots are tagged — first shot of each scene will be used as fallback");
    recommendations.push("Tag at least one key shot per scene");
  } else {
    checks.push({ name: "key_shots_tagged", status: "pass", detail: `${keyShots.length} key shots`, score: 100 });
  }

  const score = meanScore(checks);
  return { category: "shot_plans", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

function checkCaptions(captionManifest: Record<string, unknown> | null): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  if (!captionManifest) {
    checks.push({ name: "caption_manifest_exists", status: "warn", detail: "No caption manifest", score: 0 });
    warnings.push("No caption manifest found");
    recommendations.push("Generate captions from the Captions tab");
    return { category: "captions", score: 0, status: "needs_review", warnings, failures, recommendations, checks, blocking_failure: false };
  }

  checks.push({ name: "caption_manifest_exists", status: "pass", detail: "Present", score: 100 });

  const status = captionManifest.status as string | null;
  if (status !== "ready") {
    checks.push({ name: "caption_status", status: "warn", detail: `Status: ${status}`, score: 50 });
    warnings.push(`Caption manifest status is '${status}'`);
  } else {
    checks.push({ name: "caption_status", status: "pass", detail: "Ready", score: 100 });
  }

  const blocks = captionManifest.caption_blocks as unknown[] | null;
  if (!blocks || blocks.length === 0) {
    checks.push({ name: "caption_blocks", status: "warn", detail: "No caption blocks", score: 30 });
    warnings.push("Caption manifest has no caption blocks");
  } else {
    checks.push({ name: "caption_blocks", status: "pass", detail: `${blocks.length} blocks`, score: 100 });
  }

  const score = meanScore(checks);
  return { category: "captions", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

function checkRender(renderProjects: unknown[]): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  if (!renderProjects.length) {
    checks.push({ name: "render_project_exists", status: "warn", detail: "No render project", score: 0 });
    warnings.push("No render project exists");
    recommendations.push("Create a render project from the Render tab");
    return { category: "render", score: 0, status: "needs_review", warnings, failures, recommendations, checks, blocking_failure: false };
  }

  checks.push({ name: "render_project_exists", status: "pass", detail: `${renderProjects.length} project(s)`, score: 100 });

  const latest = renderProjects[0] as Record<string, unknown>;
  const renderStatus = latest.render_status as string | null;
  if (renderStatus === "failed") {
    checks.push({ name: "render_not_failed", status: "fail", detail: "Render failed", score: 0 });
    failures.push("Latest render project has failed status");
    recommendations.push("Review render logs and re-trigger render");
  } else if (renderStatus === "rendering") {
    checks.push({ name: "render_not_failed", status: "warn", detail: "Rendering in progress", score: 80 });
    warnings.push("Render is currently in progress");
  } else {
    checks.push({ name: "render_not_failed", status: "pass", detail: renderStatus ?? "pending", score: 100 });
  }

  const score = meanScore(checks);
  return { category: "render", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

function checkDrift(draft: Record<string, unknown>): CategoryResult {
  const checks: CategoryResult["checks"] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];

  const revalidationRequired = draft.revalidation_required as boolean ?? false;
  if (revalidationRequired) {
    checks.push({ name: "no_revalidation_flag", status: "warn", detail: "Revalidation required", score: 50 });
    warnings.push("Draft is flagged as requiring revalidation");
    recommendations.push("Re-run integrity check after addressing flagged issues");
  } else {
    checks.push({ name: "no_revalidation_flag", status: "pass", detail: "Not flagged", score: 100 });
  }

  const lastCapture = draft.last_captured_at as string | null;
  if (!lastCapture) {
    checks.push({ name: "capture_recency", status: "fail", detail: "Never captured", score: 0 });
    failures.push("Draft has never been captured");
  } else {
    const daysSince = (Date.now() - new Date(lastCapture).getTime()) / 86400000;
    if (daysSince > 30) {
      checks.push({ name: "capture_recency", status: "fail", detail: `${Math.round(daysSince)}d since capture`, score: 0 });
      failures.push(`Content drift: ${Math.round(daysSince)} days since last capture`);
    } else if (daysSince > 7) {
      checks.push({ name: "capture_recency", status: "warn", detail: `${Math.round(daysSince)}d since capture`, score: 60 });
      warnings.push(`Capture is ${Math.round(daysSince)} days old — consider recapturing`);
    } else {
      checks.push({ name: "capture_recency", status: "pass", detail: `${Math.round(daysSince)}d since capture`, score: 100 });
    }
  }

  const driftDeepened = draft.drift_deepened_at as string | null;
  if (driftDeepened) {
    const driftDays = (Date.now() - new Date(driftDeepened).getTime()) / 86400000;
    checks.push({ name: "drift_deepened", status: "warn", detail: `Drift deepened ${Math.round(driftDays)}d ago`, score: 50 });
    warnings.push("Drift has been detected and not yet resolved");
  }

  const score = meanScore(checks);
  return { category: "drift", score, status: scoreToStatus(score, false), warnings, failures, recommendations, checks, blocking_failure: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const auth = await requireSuperAdmin(req, supabase);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { action } = body;

    async function verifyDraftOrg(draft_id: string): Promise<{ draft: Record<string, unknown> } | Response> {
      const { data: draft, error } = await supabase
        .from("doc_studio_drafts")
        .select("*")
        .eq("id", draft_id)
        .maybeSingle();
      if (error) throw error;
      if (!draft) return errorResponse("Draft not found", 404);
      return { draft: draft as Record<string, unknown> };
    }

    if (action === "run_check") {
      const { draft_id, triggered_by = null, categories = null, persist_history = true } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const activeCategories: IntegrityCategory[] = categories ?? [
        "capture", "content", "narration", "screenshot", "scenes", "shot_plans", "captions", "render", "drift",
      ];

      const [draftRes, assetsRes, scenesRes, segmentsRes, captionRes, renderRes, shotPlansRes] = await Promise.all([
        supabase.from("doc_studio_drafts").select("*").eq("id", draft_id).maybeSingle(),
        supabase.from("doc_studio_assets").select("*").eq("draft_id", draft_id),
        supabase.from("doc_studio_scenes").select("*").eq("draft_id", draft_id).order("scene_order", { ascending: true }),
        supabase.from("documentation_narration_segments").select("*").eq("draft_id", draft_id),
        supabase.from("documentation_caption_manifests").select("status, caption_blocks, scene_coverage_pct").eq("draft_id", draft_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("doc_studio_render_projects").select("id, render_status, render_mode").eq("draft_id", draft_id).order("created_at", { ascending: false }),
        supabase.from("doc_studio_shot_plans").select("id, scene_id, is_key_shot, shot_type").eq("draft_id", draft_id),
      ]);

      if (draftRes.error) throw draftRes.error;
      if (!draftRes.data) return errorResponse("Draft not found", 404);

      const draft = draftRes.data as Record<string, unknown>;

      const assets = assetsRes.data ?? [];
      const scenes = scenesRes.data ?? [];
      const segments = segmentsRes.data ?? [];
      const captionManifest = captionRes.data ?? null;
      const renderProjects = renderRes.data ?? [];
      const shotPlans = shotPlansRes.data ?? [];

      await supabase.from("doc_studio_revalidation_events").insert({
        draft_id,
        event_type: "check_started",
        triggered_by: triggered_by ?? null,
        detail: `Integrity check started. Categories: ${activeCategories.join(", ")}`,
        outcome: null,
      });

      const categoryCheckers: Record<IntegrityCategory, () => CategoryResult> = {
        capture: () => checkCapture(draft),
        content: () => checkContent(draft),
        narration: () => checkNarration(segments),
        screenshot: () => checkScreenshots(assets),
        scenes: () => checkScenes(scenes),
        shot_plans: () => checkShotPlans(shotPlans, scenes),
        captions: () => checkCaptions(captionManifest as Record<string, unknown> | null),
        render: () => checkRender(renderProjects),
        drift: () => checkDrift(draft),
      };

      const results: CategoryResult[] = activeCategories.map((cat) => categoryCheckers[cat]());

      const { status: overallStatusValue, score: overallScore } = overallStatus(results);

      const categorySummary: Record<string, unknown> = {};
      for (const r of results) {
        categorySummary[r.category] = {
          score: r.score,
          status: r.status,
          warning_count: r.warnings.length,
          failure_count: r.failures.length,
          check_count: r.checks.length,
        };
      }

      const allWarnings = results.flatMap((r) => r.warnings.map((w) => ({ category: r.category, message: w, severity: "warning" })));
      const allFailures = results.flatMap((r) => r.failures.map((f) => ({ category: r.category, message: f, severity: "error", blocking: r.blocking_failure })));
      const allRecs = results.flatMap((r) => r.recommendations.map((rec, i) => ({ id: `${r.category}_${i}`, category: r.category, message: rec, priority: r.blocking_failure ? "high" : "normal" })));

      const { data: report, error: reportError } = await supabase
        .from("doc_studio_integrity_reports")
        .insert({
          draft_id,
          engine_version: ENGINE_VERSION,
          overall_status: overallStatusValue,
          overall_score: overallScore,
          categories_checked: activeCategories,
          category_scores: categorySummary,
          warnings: allWarnings,
          failures: allFailures,
          recommendations: allRecs,
          triggered_by: triggered_by ?? null,
          metadata_json: { categories: activeCategories.length, total_checks: results.reduce((a, r) => a + r.checks.length, 0) },
        })
        .select()
        .single();

      if (reportError) throw reportError;

      if (persist_history) {
        const historyRows: Record<string, unknown>[] = [];
        for (const r of results) {
          for (const check of r.checks) {
            historyRows.push({
              draft_id,
              report_id: report.id,
              category: r.category,
              check_name: check.name,
              status: check.status,
              score: check.score,
              detail: check.detail,
              metadata_json: {},
            });
          }
        }
        if (historyRows.length > 0) {
          await supabase.from("doc_studio_validation_history").insert(historyRows);
        }
      }

      await supabase
        .from("doc_studio_drafts")
        .update({
          integrity_status: overallStatusValue,
          integrity_score: overallScore,
          revalidation_required: overallStatusValue === "needs_recapture" || overallStatusValue === "failed_validation",
        })
        .eq("id", draft_id);

      await supabase.from("doc_studio_revalidation_events").insert({
        draft_id,
        event_type: "check_completed",
        triggered_by: triggered_by ?? null,
        detail: `Check completed. Score: ${overallScore}/100, Status: ${overallStatusValue}`,
        outcome: overallStatusValue === "healthy" || overallStatusValue === "warning" ? "passed" : "failed",
      });

      return successResponse({ report });
    }

    if (action === "mark_validated") {
      const { draft_id, notes = null } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      await supabase
        .from("doc_studio_drafts")
        .update({ integrity_status: "healthy", revalidation_required: false })
        .eq("id", draft_id);

      await supabase.from("doc_studio_revalidation_events").insert({
        draft_id,
        event_type: "manually_validated",
        triggered_by: null,
        detail: notes ?? "Manually marked as validated",
        outcome: "passed",
      });

      return successResponse({ success: true });
    }

    if (action === "request_recapture") {
      const { draft_id, reason = null } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      await supabase
        .from("doc_studio_drafts")
        .update({ integrity_status: "needs_recapture", revalidation_required: true })
        .eq("id", draft_id);

      await supabase.from("doc_studio_revalidation_events").insert({
        draft_id,
        event_type: "recapture_requested",
        triggered_by: null,
        detail: reason ?? "Recapture requested",
        outcome: null,
      });

      return successResponse({ success: true });
    }

    if (action === "resolve_drift") {
      const { draft_id, notes = null } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      await supabase
        .from("doc_studio_drafts")
        .update({ drift_deepened_at: null, revalidation_required: false })
        .eq("id", draft_id);

      await supabase.from("doc_studio_revalidation_events").insert({
        draft_id,
        event_type: "drift_resolved",
        triggered_by: null,
        detail: notes ?? "Drift resolved",
        outcome: "passed",
      });

      return successResponse({ success: true });
    }

    if (action === "request_content_regen") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      await supabase
        .from("doc_studio_drafts")
        .update({ content_generated_at: null, assembly_status: "pending" })
        .eq("id", draft_id);

      await supabase.from("doc_studio_revalidation_events").insert({
        draft_id,
        event_type: "revalidation_requested",
        triggered_by: null,
        detail: "Content regeneration requested via Integrity tab",
        outcome: "pending",
      });

      return successResponse({ success: true });
    }

    if (action === "get_report") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      const { data, error } = await supabase
        .from("doc_studio_integrity_reports")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return successResponse({ report: data });
    }

    if (action === "get_history") {
      const { draft_id, limit = 10 } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      const { data, error } = await supabase
        .from("doc_studio_integrity_reports")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return successResponse({ reports: data ?? [] });
    }

    if (action === "get_events") {
      const { draft_id, limit = 20 } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);

      const access = await verifyDraftOrg(draft_id);
      if (access instanceof Response) return access;

      const { data, error } = await supabase
        .from("doc_studio_revalidation_events")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return successResponse({ events: data ?? [] });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-integrity] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireAuth,
  verifyDocStudioDraftAccess,
  verifyOrgMembership,
} from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";


const DEFAULT_QUALITY_SETTINGS = {
  min_screenshot_coverage_pct: 60,
  min_hero_screenshot_count: 1,
  transcript_required: false,
  narration_required: false,
  drift_warning_threshold_days: 60,
  auto_mark_review_if_score_below: 50,
  excellent_threshold: 85,
  good_threshold: 70,
  needs_review_threshold: 50,
  min_audio_coverage_pct: 80,
  min_caption_coverage_pct: 60,
  timing_required: false,
  min_export_readiness_score: 60,
};

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const snake = body.organization_id;
  if (typeof snake === "string" && snake.trim().length > 0) return snake.trim();
  const camel = body.organizationId;
  if (typeof camel === "string" && camel.trim().length > 0) return camel.trim();
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const authResult = await requireAuth(req, supabase);
    if (authResult.error) return authResult.error;

    const auth = await requireAuth(req, supabase);
    if (auth.error) return auth.error;

    const body = await req.json() as Record<string, unknown>;
    const { action } = body;
    const organizationId = bodyOrganizationId(body);
    if (!organizationId) return errorResponse("organization_id required", 400);
    const membership = await verifyOrgMembership(supabase, auth.user.id, organizationId, req);
    if (membership.error) return membership.error;

    if (action === "get") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);
      const draftAccess = await verifyDocStudioDraftAccess(supabase, authResult.user.id, draft_id, req);
      if (draftAccess.error) return draftAccess.error;

      const { data, error } = await supabase
        .from("doc_studio_quality_scores")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return successResponse({ quality_score: data });
    }

    if (action === "calculate") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);
      const draftAccess = await verifyDocStudioDraftAccess(supabase, authResult.user.id, draft_id, req);
      if (draftAccess.error) return draftAccess.error;

      const [draftRes, assetsRes, scenesRes, segmentsRes, settingsRes, audioRes, captionRes, packageRes, renderRes] = await Promise.all([
        supabase.from("doc_studio_drafts").select("*").eq("id", draft_id).maybeSingle(),
        supabase.from("doc_studio_assets").select("*").eq("draft_id", draft_id),
        supabase.from("doc_studio_scenes").select("*").eq("draft_id", draft_id),
        supabase.from("documentation_narration_segments").select("*").eq("draft_id", draft_id),
        supabase.from("documentation_settings").select("value_json").eq("organization_id", organizationId).eq("key", "quality_settings_config").maybeSingle(),
        supabase.from("documentation_audio_assemblies").select("audio_coverage_pct, status").eq("draft_id", draft_id).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("documentation_caption_manifests").select("scene_coverage_pct, caption_blocks").eq("draft_id", draft_id).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("documentation_package_exports").select("package_manifest, status").eq("draft_id", draft_id).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("doc_studio_render_projects").select("id, render_status, render_manifest_json, render_mode").eq("draft_id", draft_id),
      ]);

      if (draftRes.error) throw draftRes.error;
      if (!draftRes.data) return errorResponse("Draft not found", 404);

      const settings = { ...DEFAULT_QUALITY_SETTINGS, ...(settingsRes.data?.value_json ?? {}) };
      const draft = draftRes.data;
      const assets = assetsRes.data ?? [];
      const scenes = scenesRes.data ?? [];
      const segments = segmentsRes.data ?? [];
      const audioAssembly = audioRes.data ?? null;
      const captionManifest = captionRes.data ?? null;
      const packageExport = packageRes.data ?? null;
      const renderProjects = renderRes.data ?? [];

      const scores = computeQualityScores(draft, assets, scenes, segments, settings, audioAssembly, captionManifest, packageExport, renderProjects);

      const { data: saved, error: saveError } = await supabase
        .from("doc_studio_quality_scores")
        .upsert({
          draft_id,
          ...scores,
          calculated_by: "system",
        }, { onConflict: "draft_id" })
        .select()
        .single();

      if (saveError) throw saveError;

      await supabase
        .from("doc_studio_drafts")
        .update({
          overall_quality_score: scores.overall_score,
          quality_tier: scores.quality_tier,
        })
        .eq("id", draft_id);

      return successResponse({ quality_score: saved });
    }

    if (action === "history") {
      const { draft_id, limit = 10 } = body;
      if (!draft_id) return errorResponse("draft_id required", 400);
      const draftAccess = await verifyDocStudioDraftAccess(supabase, authResult.user.id, draft_id, req);
      if (draftAccess.error) return draftAccess.error;

      const { data, error } = await supabase
        .from("doc_studio_quality_scores")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return successResponse({ history: data });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-quality] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

interface QualitySettings {
  min_screenshot_coverage_pct: number;
  min_hero_screenshot_count: number;
  transcript_required: boolean;
  narration_required: boolean;
  excellent_threshold: number;
  good_threshold: number;
  needs_review_threshold: number;
  min_audio_coverage_pct: number;
  min_caption_coverage_pct: number;
  timing_required: boolean;
  min_export_readiness_score: number;
}

function computeQualityScores(
  draft: Record<string, unknown>,
  assets: Record<string, unknown>[],
  scenes: Record<string, unknown>[],
  segments: Record<string, unknown>[],
  settings: QualitySettings,
  audioAssembly: Record<string, unknown> | null,
  captionManifest: Record<string, unknown> | null,
  packageExport: Record<string, unknown> | null,
  renderProjects: Record<string, unknown>[],
) {
  const warnings: Array<{ code: string; severity: string; message: string; field?: string }> = [];
  const screenshots = assets.filter((a) => a.asset_type === "screenshot" && !a.excluded_from_guide);

  let completionScore = 100;
  if (!draft.guide_md && !draft.edited_guide_md) { completionScore -= 40; warnings.push({ code: "NO_GUIDE", severity: "critical", message: "No guide content generated.", field: "guide" }); }
  if (scenes.length === 0) { completionScore -= 20; warnings.push({ code: "NO_SCENES", severity: "warning", message: "No scenes assembled.", field: "scene" }); }
  if (screenshots.length === 0) { completionScore -= 30; warnings.push({ code: "NO_SCREENSHOTS", severity: "critical", message: "No screenshots found.", field: "screenshot" }); }

  let screenshotScore = 100;
  if (screenshots.length === 0) {
    screenshotScore = 0;
  } else {
    const heroCount = screenshots.filter((a) => a.screenshot_role === "hero").length;
    if (heroCount < settings.min_hero_screenshot_count) { screenshotScore -= 20; warnings.push({ code: "INSUFFICIENT_HERO", severity: "warning", message: `Need ${settings.min_hero_screenshot_count} hero screenshot(s), found ${heroCount}.`, field: "screenshot" }); }
    if (scenes.length > 0) {
      const covered = new Set(screenshots.map((a) => a.scene_id).filter(Boolean)).size;
      const coverage = (covered / scenes.length) * 100;
      if (coverage < settings.min_screenshot_coverage_pct) { screenshotScore -= 25; warnings.push({ code: "LOW_COVERAGE", severity: "warning", message: `Screenshot coverage ${Math.round(coverage)}% < ${settings.min_screenshot_coverage_pct}%.`, field: "screenshot" }); }
    }
  }

  let narrationScore = settings.narration_required ? (segments.length > 0 ? 90 : 0) : (segments.length > 0 ? 80 : 70);
  const errorSegs = segments.filter((s) => s.status === "error").length;
  if (errorSegs > 0) { narrationScore -= 30; warnings.push({ code: "NARRATION_ERRORS", severity: "critical", message: `${errorSegs} narration segment(s) have errors.`, field: "narration" }); }

  let transcriptScore = 80;
  if (settings.transcript_required && !segments.some((s) => s.transcript_text)) { transcriptScore = 20; warnings.push({ code: "TRANSCRIPT_MISSING", severity: "warning", message: "Transcript is required but missing.", field: "transcript" }); }

  let structureScore = scenes.length > 0 ? 90 : 50;
  const incompleteScenes = scenes.filter((s) => s.quality_status === "incomplete").length;
  if (incompleteScenes > 0) { structureScore -= 15; warnings.push({ code: "INCOMPLETE_SCENES", severity: "warning", message: `${incompleteScenes} incomplete scene(s).`, field: "scene" }); }

  const driftStatus = (draft.drift_status as string) ?? "unknown";
  const driftScore = driftStatus === "current" ? 100 : driftStatus === "warning" ? 60 : driftStatus === "outdated" ? 20 : 70;

  // Assembly score
  let assemblyScore = 0;
  if (!audioAssembly) {
    warnings.push({ code: "AUDIO_ASSEMBLY_MISSING", severity: "warning", message: "Audio assembly has not been run yet.", field: "audio" });
  } else {
    const audioCov = (audioAssembly.audio_coverage_pct as number) ?? 0;
    assemblyScore = Math.min(100, audioCov);
    if (audioCov < settings.min_audio_coverage_pct) {
      warnings.push({ code: "LOW_AUDIO_COVERAGE", severity: "warning", message: `Audio coverage ${Math.round(audioCov)}% is below the ${settings.min_audio_coverage_pct}% threshold.`, field: "audio" });
    }
  }

  // Caption score
  let captionScore = 0;
  if (!captionManifest) {
    warnings.push({ code: "CAPTIONS_NOT_ASSEMBLED", severity: "warning", message: "Caption assembly has not been run yet.", field: "captions" });
  } else {
    const captionCov = (captionManifest.scene_coverage_pct as number) ?? 0;
    captionScore = Math.min(100, captionCov);
    if (captionCov < settings.min_caption_coverage_pct) {
      warnings.push({ code: "LOW_CAPTION_COVERAGE", severity: "warning", message: `Caption coverage ${Math.round(captionCov)}% is below the ${settings.min_caption_coverage_pct}% threshold.`, field: "captions" });
    }
  }

  // Timing score
  let timingScore = 0;
  if (!packageExport) {
    if (settings.timing_required) {
      warnings.push({ code: "TIMING_NOT_GENERATED", severity: "warning", message: "Package has not been assembled — timing manifest unavailable.", field: "assembly" });
    }
  } else {
    const pm = packageExport.package_manifest as Record<string, unknown> | null;
    const timingManifest = pm?.timing_manifest as Record<string, unknown> | null;
    const totalMs = (timingManifest?.total_duration_ms as number) ?? 0;
    if (!timingManifest || totalMs === 0) {
      timingScore = 50;
      warnings.push({ code: "TIMING_INCOMPLETE", severity: "info", message: "Timing manifest exists but has no duration data.", field: "assembly" });
    } else {
      timingScore = 100;
    }
  }

  // Export readiness score: 4 gates
  const exportGates = [
    scenes.length > 0,
    audioAssembly !== null,
    captionManifest !== null,
    packageExport !== null,
  ];
  const exportPassed = exportGates.filter(Boolean).length;
  const exportReadinessScore = Math.round((exportPassed / exportGates.length) * 100);
  if (exportReadinessScore < settings.min_export_readiness_score) {
    warnings.push({ code: "EXPORT_NOT_READY", severity: "info", message: `Export readiness ${exportReadinessScore}% — ${exportGates.length - exportPassed} pipeline step(s) incomplete.`, field: "package" });
  }

  // Render readiness score
  let renderReadinessScore = 0;
  if (renderProjects.length === 0) {
    renderReadinessScore = 0;
  } else {
    const renderedCount = renderProjects.filter((p) => p.render_status === "rendered").length;
    const readyCount = renderProjects.filter((p) => p.render_status === "ready_to_render").length;
    const manifestCount = renderProjects.filter((p) => !!p.render_manifest_json).length;
    const failedCount = renderProjects.filter((p) => p.render_status === "render_failed").length;

    if (renderedCount > 0) {
      renderReadinessScore = 100;
    } else if (readyCount > 0) {
      renderReadinessScore = 80;
    } else if (manifestCount > 0) {
      renderReadinessScore = 60;
    } else {
      renderReadinessScore = 20;
    }
    if (failedCount > 0) {
      renderReadinessScore = Math.max(0, renderReadinessScore - 30);
      warnings.push({ code: "RENDER_FAILED", severity: "warning", message: `${failedCount} render project(s) failed. Rebuild the manifest and retry.`, field: "assembly" });
    }
  }

  // Weighted overall — sums to 100%
  const overall = Math.round(
    completionScore    * 0.20 +
    screenshotScore    * 0.20 +
    narrationScore     * 0.10 +
    transcriptScore    * 0.08 +
    structureScore     * 0.10 +
    driftScore         * 0.07 +
    assemblyScore      * 0.10 +
    captionScore       * 0.08 +
    timingScore        * 0.05 +
    exportReadinessScore * 0.02,
  );

  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const overallClamped = clamp(overall);

  let quality_tier = "incomplete";
  if (driftStatus === "outdated" && screenshots.length > 0) {
    quality_tier = "outdated";
  } else if (overallClamped >= settings.excellent_threshold) {
    quality_tier = "excellent";
  } else if (overallClamped >= settings.good_threshold) {
    quality_tier = "good";
  } else if (overallClamped >= settings.needs_review_threshold) {
    quality_tier = "needs_review";
  } else if (screenshots.length > 0 && segments.length > 0) {
    quality_tier = "needs_recapture";
  }

  const recommendation = quality_tier === "excellent"
    ? "Ready to publish."
    : quality_tier === "good"
    ? "Good shape. Address warnings before publishing."
    : quality_tier === "outdated"
    ? "Content is outdated. Recapture screenshots before publishing."
    : quality_tier === "needs_recapture"
    ? "Screenshots or narration need attention before this can be published."
    : `Improve quality (score: ${overallClamped}/100) before publishing.`;

  return {
    overall_score: overallClamped,
    completion_score: clamp(completionScore),
    screenshot_score: clamp(screenshotScore),
    narration_score: clamp(narrationScore),
    transcript_score: clamp(transcriptScore),
    structure_score: clamp(structureScore),
    drift_score: clamp(driftScore),
    assembly_score: clamp(assemblyScore),
    caption_score: clamp(captionScore),
    timing_score: clamp(timingScore),
    export_readiness_score: clamp(exportReadinessScore),
    render_readiness_score: clamp(renderReadinessScore),
    quality_tier,
    warnings_json: warnings,
    recommendation,
  };
}

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

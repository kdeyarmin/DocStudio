import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireSuperAdmin, requireInternalOrDraftAccess } from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";

function estimateDuration(text: string, wpm = 140): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / wpm) * 60 * 10) / 10);
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
    const { action, draft_id } = body;

    if (!draft_id) {
      return jsonResponse({ success: false, error: "draft_id required" }, 400);
    }

    const access = await requireInternalOrDraftAccess(req, supabase, draft_id);
    if (!access.ok) {
      return access.error;
    }

    const { data: pkgDraft } = await supabase
      .from("doc_studio_drafts")
      .select("organization_id")
      .eq("id", draft_id)
      .maybeSingle();
    if (!pkgDraft) {
      return jsonResponse({ success: false, error: "Draft not found" }, 404);
    }
    const organization_id = access.organizationId;

    if (action === "assemble_package") {
      const [
        { data: draft },
        { data: scenes },
        { data: segments },
        { data: audioAssembly },
        { data: captionManifest },
        { data: qualityScoreRow },
        { data: driftChecksData },
      ] = await Promise.all([
        supabase.from("doc_studio_drafts").select("title, quality_score").eq("id", draft_id).single(),
        supabase.from("doc_studio_scenes").select("id, title, position").eq("draft_id", draft_id).order("position"),
        supabase.from("documentation_narration_segments").select("id, scene_id, audio_asset_id, duration_seconds, narration_text, timing_metadata").eq("draft_id", draft_id),
        supabase.from("documentation_audio_assemblies").select("*").eq("draft_id", draft_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("documentation_caption_manifests").select("*").eq("draft_id", draft_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("doc_studio_quality_scores").select("*").eq("draft_id", draft_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("doc_studio_drift_checks").select("drift_status").eq("draft_id", draft_id),
      ]);

      const draftTitle = draft?.title ?? "Untitled Tutorial";
      const segByScene = new Map((segments ?? []).map(s => [s.scene_id, s]));

      let offsetSeconds = 0;
      const sceneManifest = (scenes ?? []).map((scene, idx) => {
        const seg = segByScene.get(scene.id);
        const duration = seg?.duration_seconds ?? estimateDuration(seg?.narration_text ?? "");
        const entry = {
          scene_id: scene.id,
          scene_title: scene.title ?? `Scene ${idx + 1}`,
          scene_position: scene.position ?? idx,
          has_screenshot: false,
          has_audio: !!(seg?.audio_asset_id),
          has_timing: !!(seg?.timing_metadata && Object.keys(seg.timing_metadata).length > 0),
          has_captions: false,
          audio_asset_id: seg?.audio_asset_id ?? null,
          duration_seconds: duration,
          caption_block_count: 0,
          narration_word_count: (seg?.narration_text ?? "").split(/\s+/).filter(Boolean).length,
        };
        offsetSeconds += duration;
        return entry;
      });

      const captionBlocks = (captionManifest?.caption_blocks ?? []) as Array<{ scene_id?: string }>;
      const captionScenes = new Set(captionBlocks.map(b => b.scene_id).filter(Boolean));
      for (const entry of sceneManifest) {
        entry.has_captions = captionScenes.has(entry.scene_id);
        entry.caption_block_count = captionBlocks.filter(b => b.scene_id === entry.scene_id).length;
      }

      const audioCovPct = audioAssembly?.audio_coverage_pct ?? 0;
      const captionCovPct = captionManifest?.scene_coverage_pct ?? 0;
      const qualityScore = qualityScoreRow?.overall_score ?? draft?.quality_score ?? 0;
      const qualityTier = qualityScoreRow?.quality_tier ?? "incomplete";
      const warningsJson = (qualityScoreRow?.warnings_json ?? []) as Array<{ severity: string }>;
      const driftChecks = driftChecksData ?? [];
      const driftCurrent = driftChecks.filter(d => d.drift_status === "current").length;
      const driftWarning = driftChecks.filter(d => d.drift_status === "warning").length;
      const driftOutdated = driftChecks.filter(d => d.drift_status === "outdated").length;
      const driftOverall = driftOutdated > 0 ? "outdated" : driftWarning > 0 ? "warning" : driftChecks.length > 0 ? "current" : "unknown";
      const version = `1.${Date.now()}`;

      const timingManifest = {
        draft_id,
        draft_title: draftTitle,
        schema_version: "1.0",
        generated_at: new Date().toISOString(),
        total_duration_ms: Math.round(offsetSeconds * 1000),
        total_scenes: (scenes ?? []).length,
        scenes: sceneManifest.map((s, i) => ({
          scene_id: s.scene_id,
          scene_title: s.scene_title,
          scene_position: s.scene_position,
          start_ms: Math.round(sceneManifest.slice(0, i).reduce((a, x) => a + x.duration_seconds, 0) * 1000),
          end_ms: Math.round(sceneManifest.slice(0, i + 1).reduce((a, x) => a + x.duration_seconds, 0) * 1000),
          duration_ms: Math.round(s.duration_seconds * 1000),
          narration_segment_timings: [],
          screenshot_display_timings: [],
          caption_timing_blocks: [],
          transition_timing_placeholder: { type: "cut", duration_ms: 0 },
          callout_timing_placeholders: [],
        })),
        global_transitions: [],
        global_audio_offset_ms: 0,
        provider: "mock",
      };

      const assetManifest = (segments ?? [])
        .filter(s => s.audio_asset_id)
        .map(s => ({
          asset_id: s.audio_asset_id,
          asset_type: "audio",
          scene_id: s.scene_id,
          file_size_bytes: 0,
          mime_type: "audio/mpeg",
          duration_seconds: s.duration_seconds ?? 0,
          url: null,
        }));

      const packageManifest = {
        draft_id,
        draft_title: draftTitle,
        package_version: version,
        generated_at: new Date().toISOString(),
        schema_version: "1.0",
        total_scenes: (scenes ?? []).length,
        total_estimated_duration_seconds: Math.ceil(offsetSeconds),
        audio_coverage_pct: audioCovPct,
        caption_coverage_pct: captionCovPct,
        scenes: sceneManifest,
        assets: assetManifest,
        variants: [],
        timing_manifest: timingManifest,
        quality_summary: {
          overall_score: qualityScore,
          tier: qualityTier,
          warning_count: warningsJson.length,
          critical_warning_count: warningsJson.filter(w => w.severity === "critical").length,
          audio_completeness: audioCovPct,
          caption_coverage: captionCovPct,
          timing_manifest_completeness: sceneManifest.some(s => s.has_timing) ? 100 : 0,
          package_assembly_completeness: Math.round(
            ([(scenes ?? []).length > 0, audioAssembly !== null, captionManifest !== null].filter(Boolean).length / 3) * 100
          ),
          export_readiness: qualityScoreRow?.export_readiness_score ?? 0,
        },
        drift_summary: {
          total_checks: driftChecks.length,
          current_count: driftCurrent,
          warning_count: driftWarning,
          outdated_count: driftOutdated,
          overall_status: driftOverall,
        },
      };

      const { data: packageExport, error: insertErr } = await supabase
        .from("documentation_package_exports")
        .insert({
          draft_id,
          organization_id,
          export_type: "json",
          status: "completed",
          package_manifest: packageManifest,
          scene_count: (scenes ?? []).length,
          asset_count: assetManifest.length,
          total_duration_seconds: Math.ceil(offsetSeconds),
          package_version: version,
          exported_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      await supabase
        .from("doc_studio_drafts")
        .update({
          assembly_status: "assembled",
          last_assembled_at: new Date().toISOString(),
          package_version: version,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft_id);

      return jsonResponse({ success: true, package_export: packageExport });
    }

    if (action === "get_package") {
      const { data: packageExport, error: getErr } = await supabase
        .from("documentation_package_exports")
        .select("*")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (getErr) throw getErr;

      return jsonResponse({ success: true, package_export: packageExport });
    }

    if (action === "list_packages") {
      const { data: packages, error: listErr } = await supabase
        .from("documentation_package_exports")
        .select("id, draft_id, export_type, status, package_version, scene_count, total_duration_seconds, exported_at")
        .eq("draft_id", draft_id)
        .order("created_at", { ascending: false });
      if (listErr) throw listErr;

      return jsonResponse({ success: true, packages: packages ?? [] });
    }

    if (action === "run_full_assembly") {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const serviceAuth = `Bearer ${serviceKey}`;

      const assemblyRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/doc-studio-assembly`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": serviceAuth },
          body: JSON.stringify({ action: "assemble_audio", draft_id, organization_id }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const assemblyData = await assemblyRes.json();
      if (!assemblyData.success) throw new Error(assemblyData.error ?? "Audio assembly failed");

      const captionRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/doc-studio-assembly`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": serviceAuth },
          body: JSON.stringify({ action: "assemble_captions", draft_id, organization_id }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const captionData = await captionRes.json();
      if (!captionData.success) throw new Error(captionData.error ?? "Caption assembly failed");

      const packageRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/doc-studio-package`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": serviceAuth },
          body: JSON.stringify({ action: "assemble_package", draft_id, organization_id }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const packageData = await packageRes.json();
      if (!packageData.success) throw new Error(packageData.error ?? "Package assembly failed");

      return jsonResponse({
        success: true,
        audio_assembly: assemblyData.assembly,
        caption_manifest: captionData.caption_manifest,
        package_export: packageData.package_export,
      });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[doc-studio-package] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createServiceClient,
  requireAuth,
  verifyDocStudioDraftAccess,
} from "../_shared/auth.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const supabase = createServiceClient();
    const authResult = await requireAuth(req, supabase);
    if (authResult.error) return authResult.error;
    const userId = authResult.user.id;

    const body = await req.json();
    const { action } = body;

    if (action === "build_package") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400, req);
      const draftAccess = await verifyDocStudioDraftAccess(supabase, userId, draft_id, req);
      if (draftAccess.error) return draftAccess.error;

      const [draftRes, assetsRes, scenesRes, segmentsRes, qualityRes, driftRes] = await Promise.all([
        supabase.from("doc_studio_drafts").select("*").eq("id", draft_id).maybeSingle(),
        supabase.from("doc_studio_assets").select("*").eq("draft_id", draft_id).order("sort_order"),
        supabase.from("doc_studio_scenes").select("*").eq("draft_id", draft_id).order("scene_order"),
        supabase.from("documentation_narration_segments").select("*").eq("draft_id", draft_id).order("segment_order"),
        supabase.from("doc_studio_quality_scores").select("*").eq("draft_id", draft_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("doc_studio_drift_checks").select("*").eq("draft_id", draft_id),
      ]);

      if (draftRes.error) throw draftRes.error;
      if (!draftRes.data) return errorResponse("Draft not found", 404, req);

      const draft = draftRes.data;
      const assets = assetsRes.data ?? [];
      const scenes = scenesRes.data ?? [];
      const segments = segmentsRes.data ?? [];
      const qualityScore = qualityRes.data ?? null;
      const driftChecks = driftRes.data ?? [];

      const captionManifest = buildCaptionManifest(draft_id, draft.title ?? "Untitled", scenes, segments);
      const sceneSyncMap = buildSceneSyncMap(draft_id, scenes, segments, captionManifest);
      const assetManifest = assets
        .filter((a) => !a.excluded_from_guide)
        .map((a) => ({
          id: a.id,
          file_name: a.file_name,
          file_url: a.file_url ?? a.public_url,
          asset_type: a.asset_type,
          screenshot_role: a.screenshot_role ?? "step",
          scene_id: a.scene_id ?? null,
        }));

      const roleVariants = draft.role_variants_json
        ? Object.values(draft.role_variants_json as Record<string, unknown>)
        : [];

      const exportPackage = {
        draft_id,
        title: draft.title ?? "Untitled",
        version_label: draft.version ?? "v1.0",
        target_role: draft.target_role ?? "staff",
        tutorial_group: draft.tutorial_group ?? "",
        quality_tier: qualityScore?.quality_tier ?? draft.quality_tier ?? "incomplete",
        overall_quality_score: qualityScore?.overall_score ?? draft.overall_quality_score ?? 0,
        scene_count: scenes.length,
        narration_segment_count: segments.length,
        guide_markdown: draft.guide_md ?? draft.edited_guide_md ?? "",
        narration_script: segments.map((s: Record<string, unknown>) => s.narration_text).join("\n\n"),
        scenes,
        narration_segments: segments,
        caption_manifest: captionManifest,
        scene_sync_map: sceneSyncMap,
        quality_score: qualityScore,
        drift_checks: driftChecks,
        role_variants: roleVariants,
        asset_manifest: assetManifest,
        exported_at: new Date().toISOString(),
      };

      return successResponse({ package: exportPackage });
    }

    if (action === "export_srt") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400, req);
      const draftAccess = await verifyDocStudioDraftAccess(supabase, userId, draft_id, req);
      if (draftAccess.error) return draftAccess.error;

      const [scenesRes, segmentsRes, draftRes] = await Promise.all([
        supabase.from("doc_studio_scenes").select("id, title").eq("draft_id", draft_id).order("scene_order"),
        supabase.from("documentation_narration_segments").select("*").eq("draft_id", draft_id).order("segment_order"),
        supabase.from("doc_studio_drafts").select("title").eq("id", draft_id).maybeSingle(),
      ]);

      const scenes = scenesRes.data ?? [];
      const segments = segmentsRes.data ?? [];
      const manifest = buildCaptionManifest(draft_id, draftRes.data?.title ?? "Untitled", scenes, segments);
      const srt = buildSRT(manifest);

      return successResponse({ srt, caption_manifest: manifest });
    }

    if (action === "export_guide_md") {
      const { draft_id } = body;
      if (!draft_id) return errorResponse("draft_id required", 400, req);
      const draftAccess = await verifyDocStudioDraftAccess(supabase, userId, draft_id, req);
      if (draftAccess.error) return draftAccess.error;

      const { data: draft, error } = await supabase
        .from("doc_studio_drafts")
        .select("title, guide_md, edited_guide_md, version, target_role")
        .eq("id", draft_id)
        .maybeSingle();

      if (error) throw error;
      if (!draft) return errorResponse("Draft not found", 404, req);

      const markdown = draft.edited_guide_md ?? draft.guide_md ?? "";
      const slug = (draft.title ?? "guide").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const filename = `${slug}-${draft.version ?? "v1"}-guide.md`;

      return successResponse({ markdown, filename, title: draft.title });
    }

    return errorResponse(`Unknown action: ${action}`, 400, req);
  } catch (err: unknown) {
    console.error('[doc-studio-export] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, req);
  }
});

function buildCaptionManifest(
  draftId: string,
  draftTitle: string,
  scenes: Record<string, unknown>[],
  segments: Record<string, unknown>[],
) {
  const segByScene = new Map<string, Record<string, unknown>>();
  for (const s of segments) {
    if (s.scene_id) segByScene.set(String(s.scene_id), s);
  }

  let runningTime = 0;
  const blocks: Array<{ id: string; scene_id: string | null; segment_order: number; start_time_seconds: number; end_time_seconds: number; text: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const seg = segByScene.get(String(scene.id));
    const text = String((seg?.caption_text ?? seg?.narration_text) ?? scene.title ?? "");
    const wpm = 140;
    const words = text.split(/\s+/).filter(Boolean).length;
    const duration = Math.max(3, (words / wpm) * 60);

    const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    const timePerSentence = duration / sentences.length;

    for (let j = 0; j < sentences.length; j++) {
      const t = sentences[j].trim();
      if (!t) continue;
      blocks.push({
        id: `scene_${i}_block_${j}`,
        scene_id: String(scene.id),
        segment_order: i * 100 + j,
        start_time_seconds: parseFloat((runningTime + j * timePerSentence).toFixed(3)),
        end_time_seconds: parseFloat((runningTime + (j + 1) * timePerSentence).toFixed(3)),
        text: t,
      });
    }
    runningTime += duration;
  }

  return {
    draft_id: draftId,
    draft_title: draftTitle,
    total_duration_seconds: parseFloat(runningTime.toFixed(3)),
    scene_count: scenes.length,
    blocks,
    generated_at: new Date().toISOString(),
  };
}

function buildSceneSyncMap(
  draftId: string,
  scenes: Record<string, unknown>[],
  segments: Record<string, unknown>[],
  captionManifest: ReturnType<typeof buildCaptionManifest>,
) {
  const segByScene = new Map<string, Record<string, unknown>>();
  for (const s of segments) {
    if (s.scene_id) segByScene.set(String(s.scene_id), s);
  }
  const captionsByScene = new Map<string, typeof captionManifest.blocks>();
  for (const b of captionManifest.blocks) {
    if (!b.scene_id) continue;
    if (!captionsByScene.has(b.scene_id)) captionsByScene.set(b.scene_id, []);
    captionsByScene.get(b.scene_id)!.push(b);
  }

  return {
    draft_id: draftId,
    scenes: scenes.map((s, i) => {
      const seg = segByScene.get(String(s.id));
      return {
        scene_id: s.id,
        scene_order: s.scene_order ?? i,
        title: s.title,
        start_time_seconds: s.start_time_seconds ?? 0,
        end_time_seconds: s.end_time_seconds ?? 0,
        narration_segment_id: seg?.id ?? null,
        audio_asset_id: seg?.audio_asset_id ?? null,
        caption_blocks: captionsByScene.get(String(s.id)) ?? [],
      };
    }),
    total_duration_seconds: scenes.length > 0 ? Math.max(...scenes.map((s) => Number(s.end_time_seconds ?? 0))) : 0,
  };
}

function buildSRT(manifest: { blocks: Array<{ start_time_seconds: number; end_time_seconds: number; text: string }> }): string {
  const lines: string[] = [];
  for (let i = 0; i < manifest.blocks.length; i++) {
    const b = manifest.blocks[i];
    lines.push(String(i + 1));
    lines.push(`${srtTime(b.start_time_seconds)} --> ${srtTime(b.end_time_seconds)}`);
    lines.push(b.text);
    lines.push("");
  }
  return lines.join("\n");
}

function srtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function successResponse(data: Record<string, unknown>, req?: Request) {
  return jsonResponse({ success: true, ...data }, 200, req);
}

function errorResponse(message: string, status = 400, req?: Request) {
  return jsonResponse({ success: false, error: message }, status, req);
}

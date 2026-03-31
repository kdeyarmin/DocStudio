import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, requireSuperAdmin } from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rate-limit.ts";
import { isValidUUID } from "../_shared/validate.ts";

interface RenderManifestScene {
  scene_id: string;
  scene_order: number;
  title: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  video_segments: unknown[];
  screenshot_overlays: unknown[];
  narration: { audio_asset_id: string | null; audio_url: string | null; start_ms: number; duration_ms: number; word_timings: unknown[] } | null;
  captions: Array<{ text: string; start_ms: number; end_ms: number }>;
  callout: { title: string; description: string | null; start_ms: number; duration_ms: number } | null;
  zoom_effect: unknown | null;
  highlight_effect: unknown | null;
  transition_in: { type: string; duration_ms: number } | null;
  transition_out: { type: string; duration_ms: number } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    // Rate limit: 20 render requests per 10 minutes per IP
    const ip = getClientIp(req);
    const rl = checkRateLimit(`doc-render:${ip}`, { maxRequests: 20, windowSeconds: 600 });
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...rateLimitHeaders(rl) } },
      );
    }

    const supabase = createServiceClient();
    const auth = await requireSuperAdmin(req, supabase);
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "POST" ? "build_manifest" : "get_project");

    if (req.method === "GET" && action === "get_project") {
      const projectId = url.searchParams.get("project_id");
      if (!projectId || !isValidUUID(projectId)) {
        return jsonResponse({ error: "Valid project_id required" }, 400);
      }
      const { data, error } = await supabase
        .from("doc_studio_render_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "Render project not found" }, 404);
      return jsonResponse({ success: true, data });
    }

    if (req.method === "GET" && action === "list_projects") {
      const draftId = url.searchParams.get("draft_id");
      if (!draftId) {
        return jsonResponse({ error: "draft_id required" }, 400);
      }
      const query = supabase
        .from("doc_studio_render_projects")
        .select("*")
        .eq("draft_id", draftId)
        .order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    if (req.method === "POST" && action === "build_manifest") {
      const body = await req.json();
      const { project_id, draft_id } = body;

      if (!project_id || !draft_id) {
        return jsonResponse({ error: "project_id and draft_id required" }, 400);
      }

      const { data: project, error: projError } = await supabase
        .from("doc_studio_render_projects")
        .select("*")
        .eq("id", project_id)
        .maybeSingle();
      if (projError || !project) {
        return jsonResponse({ error: "Render project not found" }, 404);
      }

      await supabase
        .from("doc_studio_render_projects")
        .update({ render_status: "assembling_assets" })
        .eq("id", project_id);

      const [scenesRes, narrationRes, assetsRes, captionRes] = await Promise.all([
        supabase
          .from("doc_studio_scenes")
          .select("id, scene_order, title, start_time_seconds, end_time_seconds, duration_seconds, narration_text, visual_emphasis_json")
          .eq("draft_id", draft_id)
          .order("scene_order", { ascending: true }),
        supabase
          .from("documentation_narration_segments")
          .select("scene_id, audio_asset_id, timing_json, target_duration_seconds")
          .eq("draft_id", draft_id)
          .eq("status", "ready"),
        supabase
          .from("doc_studio_assets")
          .select("id, scene_id, screenshot_role, public_url, sort_order")
          .eq("draft_id", draft_id)
          .in("asset_type", ["screenshot"])
          .order("sort_order", { ascending: true }),
        supabase
          .from("documentation_caption_manifests")
          .select("caption_json")
          .eq("draft_id", draft_id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (scenesRes.error) throw scenesRes.error;
      if (narrationRes.error) console.warn("Narration query failed:", narrationRes.error.message);
      if (assetsRes.error) console.warn("Assets query failed:", assetsRes.error.message);
      if (captionRes.error) console.warn("Caption query failed:", captionRes.error.message);

      const scenes = scenesRes.data ?? [];
      const renderConfig = project.render_config_json ?? {};
      const transitions = renderConfig.transitions ?? { type: "crossfade", duration_ms: 400 };

      const narrationByScene = new Map<string, { audio_asset_id: string | null; timing_json: Record<string, unknown>; target_duration_seconds: number | null }>();
      (narrationRes.data ?? []).forEach((n: { scene_id: string | null; audio_asset_id: string | null; timing_json: Record<string, unknown>; target_duration_seconds: number | null }) => {
        if (n.scene_id) narrationByScene.set(n.scene_id, n as { audio_asset_id: string | null; timing_json: Record<string, unknown>; target_duration_seconds: number | null });
      });

      const assetsByScene = new Map<string, Array<{ id: string; screenshot_role: string; public_url: string; sort_order: number }>>();
      (assetsRes.data ?? []).forEach((a: { id: string; scene_id: string | null; screenshot_role: string; public_url: string; sort_order: number }) => {
        if (a.scene_id) {
          if (!assetsByScene.has(a.scene_id)) assetsByScene.set(a.scene_id, []);
          assetsByScene.get(a.scene_id)?.push(a as { id: string; screenshot_role: string; public_url: string; sort_order: number });
        }
      });

      const captionBlocks = (captionRes.data?.caption_json ?? []) as Array<{ scene_id: string | null; segment_order: number; start_time_seconds: number; end_time_seconds: number; text: string }>;
      const captionsByScene = new Map<string, typeof captionBlocks>();
      captionBlocks.forEach((b) => {
        if (b.scene_id) {
          if (!captionsByScene.has(b.scene_id)) captionsByScene.set(b.scene_id, []);
          captionsByScene.get(b.scene_id)?.push(b);
        }
      });

      const audioIds = [...narrationByScene.values()].map((n) => n.audio_asset_id).filter(Boolean) as string[];
      const audioUrlMap = new Map<string, string>();
      if (audioIds.length > 0) {
        const { data: audioAssets } = await supabase.from("doc_studio_assets").select("id, public_url").in("id", audioIds);
        (audioAssets ?? []).forEach((a: { id: string; public_url: string }) => audioUrlMap.set(a.id, a.public_url));
      }

      let cursor = 0;
      const { error: statusErr } = await supabase.from("doc_studio_render_projects").update({ render_status: "building_timeline" }).eq("id", project_id);
      if (statusErr) console.error("[doc-studio-render] Failed to update render status:", statusErr.message);

      const timelineScenes: RenderManifestScene[] = scenes.map((scene: { id: string; scene_order: number; title: string; start_time_seconds: number | null; end_time_seconds: number | null; duration_seconds: number | null; visual_emphasis_json: Record<string, unknown> | null }) => {
        const durationMs = Math.round((scene.duration_seconds ?? 5) * 1000);
        const startMs = cursor;
        const endMs = startMs + durationMs;
        cursor = endMs;

        const emphasis = scene.visual_emphasis_json ?? {};
        const calloutTitle = emphasis.callout_title as string | null ?? null;
        const calloutDesc = emphasis.callout_description as string | null ?? null;
        const zoomRegion = emphasis.zoom_region as Record<string, number> | null ?? null;
        const highlightRegion = emphasis.highlight_region as Record<string, number> | null ?? null;

        const narration = narrationByScene.get(scene.id);
        const narrationDurationMs = narration?.target_duration_seconds
          ? Math.round(narration.target_duration_seconds * 1000)
          : durationMs;

        const sceneAssets = assetsByScene.get(scene.id) ?? [];
        const perMs = sceneAssets.length > 0 ? Math.floor(durationMs / sceneAssets.length) : durationMs;
        const screenshots = sceneAssets.map((a, idx) => ({
          asset_id: a.id,
          public_url: a.public_url,
          screenshot_role: a.screenshot_role,
          display_start_ms: idx * perMs,
          display_end_ms: Math.min((idx + 1) * perMs, durationMs),
          zoom_region: null,
          highlight_region: null,
        }));

        const captions = (captionsByScene.get(scene.id) ?? []).map((c) => ({
          text: c.text,
          start_ms: Math.round(c.start_time_seconds * 1000),
          end_ms: Math.round(c.end_time_seconds * 1000),
        }));

        return {
          scene_id: scene.id,
          scene_order: scene.scene_order,
          title: scene.title,
          start_ms: startMs,
          end_ms: endMs,
          duration_ms: durationMs,
          video_segments: [{
            segment_order: 1,
            source_asset_id: null,
            source_start_ms: 0,
            source_end_ms: durationMs,
            output_start_ms: startMs,
            output_end_ms: endMs,
            playback_speed: 1.0,
            has_zoom: !!zoomRegion,
            zoom_region: zoomRegion,
            has_highlight: !!highlightRegion,
            highlight_region: highlightRegion,
          }],
          screenshot_overlays: screenshots,
          narration: narration
            ? {
                audio_asset_id: narration.audio_asset_id,
                audio_url: narration.audio_asset_id ? (audioUrlMap.get(narration.audio_asset_id) ?? null) : null,
                start_ms: 0,
                duration_ms: narrationDurationMs,
                word_timings: ((narration.timing_json as Record<string, unknown>)?.words as unknown[]) ?? [],
              }
            : null,
          captions,
          callout: calloutTitle ? { title: calloutTitle, description: calloutDesc, start_ms: 0, duration_ms: 3000 } : null,
          zoom_effect: zoomRegion ? { region: zoomRegion, start_ms: 0, duration_ms: durationMs } : null,
          highlight_effect: highlightRegion ? { region: highlightRegion, start_ms: 0, duration_ms: durationMs } : null,
          transition_in: { type: transitions.type, duration_ms: transitions.duration_ms },
          transition_out: { type: transitions.type, duration_ms: transitions.duration_ms },
        };
      });

      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("title")
        .eq("id", draft_id)
        .maybeSingle();

      const manifest = {
        render_project_id: project_id,
        draft_id,
        draft_title: draft?.title ?? "Untitled",
        render_mode: project.render_mode,
        render_config: renderConfig,
        total_duration_ms: cursor,
        scene_count: scenes.length,
        scenes: timelineScenes,
        generated_at: new Date().toISOString(),
        schema_version: "1.0",
      };

      await supabase
        .from("doc_studio_render_projects")
        .update({
          render_manifest_json: manifest,
          total_duration_ms: cursor,
          scene_count: scenes.length,
          render_status: "ready_to_render",
          assembled_at: new Date().toISOString(),
        })
        .eq("id", project_id);

      return jsonResponse({ success: true, manifest });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error('[doc-studio-render] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

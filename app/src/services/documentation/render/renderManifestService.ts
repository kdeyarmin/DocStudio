import { supabase } from '../../../lib/supabase';
import type {
  RenderManifest,
  RenderTimelineScene,
  RenderConfig,
  RenderMode,
  ScreenshotRole,
  DocumentationShotPlan,
  ShotTransition,
  BoundingRegion,
} from '../../../types/documentation';
import { getEffectiveSceneRuntime } from '../audio/audioSequenceService';

// ─── DB row types ─────────────────────────────────────────────────────────────

interface SceneRow {
  id: string;
  scene_order: number;
  title: string;
  start_time_seconds: number | null;
  end_time_seconds: number | null;
  duration_seconds: number | null;
  visual_emphasis_json: Record<string, unknown> | null;
}

interface NarrationRow {
  scene_id: string | null;
  audio_asset_id: string | null;
  timing_json: Record<string, unknown> | null;
  target_duration_seconds: number | null;
}

interface AssetRow {
  id: string;
  scene_id: string | null;
  screenshot_role: ScreenshotRole;
  file_url: string;
  sort_order: number;
}

interface CaptionRow {
  scene_id: string | null;
  segment_order: number;
  start_time_seconds: number;
  end_time_seconds: number;
  text: string;
}

interface AudioAssetRow {
  id: string;
  file_url: string;
}

// ─── Transition helpers ───────────────────────────────────────────────────────

const SHOT_TRANSITION_DURATION_MS: Record<ShotTransition, number> = {
  cut: 0,
  crossfade: 400,
  fade_to_black: 500,
  fade_from_black: 500,
  slide_left: 350,
  slide_right: 350,
  wipe: 300,
  zoom_in: 400,
  zoom_out: 400,
  none: 0,
};

function mapShotTransition(t: ShotTransition, overrideDurationMs?: number) {
  return {
    type: t === 'none' ? 'cut' : t,
    duration_ms: overrideDurationMs ?? SHOT_TRANSITION_DURATION_MS[t],
  };
}

// ─── Shot-plan helpers ────────────────────────────────────────────────────────

function buildVideoSegmentsFromShots(
  shots: DocumentationShotPlan[],
  sceneDurationMs: number,
  sceneStartMs: number,
): RenderTimelineScene['video_segments'] {
  const useFixedTiming = shots.every(
    (s) =>
      s.pacing_mode === 'fixed_duration' &&
      s.start_time_seconds >= 0 &&
      s.end_time_seconds > s.start_time_seconds,
  );

  if (useFixedTiming) {
    return shots.map((shot, i) => {
      const startMs = Math.round(shot.start_time_seconds * 1000);
      const endMs = Math.round(shot.end_time_seconds * 1000);
      const r = shot.zoom_region_json as BoundingRegion | null;
      const h = shot.highlight_region_json as BoundingRegion | null;
      return {
        segment_order: i + 1,
        source_asset_id: shot.source_asset_id,
        source_start_ms: startMs,
        source_end_ms: endMs,
        output_start_ms: sceneStartMs + startMs,
        output_end_ms: sceneStartMs + endMs,
        playback_speed: 1.0,
        has_zoom: !!r,
        zoom_region: r,
        has_highlight: !!h,
        highlight_region: h,
      };
    });
  }

  const segMs = Math.floor(sceneDurationMs / shots.length);
  return shots.map((shot, i) => {
    const startMs = segMs * i;
    const endMs = i === shots.length - 1 ? sceneDurationMs : segMs * (i + 1);
    const r = shot.zoom_region_json as BoundingRegion | null;
    const h = shot.highlight_region_json as BoundingRegion | null;
    return {
      segment_order: i + 1,
      source_asset_id: shot.source_asset_id,
      source_start_ms: startMs,
      source_end_ms: endMs,
      output_start_ms: sceneStartMs + startMs,
      output_end_ms: sceneStartMs + endMs,
      playback_speed: 1.0,
      has_zoom: !!r,
      zoom_region: r,
      has_highlight: !!h,
      highlight_region: h,
    };
  });
}

function buildScreenshotOverlaysFromShots(
  shots: DocumentationShotPlan[],
  sceneAssets: AssetRow[],
  sceneDurationMs: number,
): RenderTimelineScene['screenshot_overlays'] {
  const assetById = new Map(sceneAssets.map((a) => [a.id, a]));
  const shotsWithAsset = shots.filter(
    (s) => s.source_asset_id && assetById.has(s.source_asset_id),
  );

  if (shotsWithAsset.length > 0) {
    const segMs = Math.floor(sceneDurationMs / shotsWithAsset.length);
    return shotsWithAsset.map((shot, i) => {
      const asset = assetById.get(shot.source_asset_id!)!;
      const startMs = segMs * i;
      const endMs = i === shotsWithAsset.length - 1 ? sceneDurationMs : segMs * (i + 1);
      return {
        asset_id: asset.id,
        file_url: asset.file_url,
        screenshot_role: asset.screenshot_role,
        display_start_ms: startMs,
        display_end_ms: endMs,
        zoom_region: shot.zoom_region_json as BoundingRegion | null,
        highlight_region: shot.highlight_region_json as BoundingRegion | null,
      };
    });
  }

  const perOverlayMs = sceneAssets.length > 0 ? Math.round(sceneDurationMs / sceneAssets.length) : sceneDurationMs;
  let overlayCursor = 0;
  return sceneAssets.map((a) => {
    const oms = overlayCursor;
    overlayCursor += perOverlayMs;
    return {
      asset_id: a.id,
      file_url: a.file_url,
      screenshot_role: a.screenshot_role,
      display_start_ms: oms,
      display_end_ms: Math.min(oms + perOverlayMs, sceneDurationMs),
      zoom_region: null as BoundingRegion | null,
      highlight_region: null as BoundingRegion | null,
    };
  });
}

interface KeyVisuals {
  zoomRegion: BoundingRegion | null;
  highlightRegion: BoundingRegion | null;
  calloutTitle: string | null;
  calloutDesc: string | null;
  calloutStartMs: number;
  calloutEndMs: number;
  calloutDurationMs: number;
  transitionIn: { type: string; duration_ms: number };
  transitionOut: { type: string; duration_ms: number };
}

function extractKeyVisuals(shots: DocumentationShotPlan[]): KeyVisuals {
  if (shots.length === 0) {
    return { zoomRegion: null, highlightRegion: null, calloutTitle: null, calloutDesc: null, calloutStartMs: 0, calloutEndMs: 0, calloutDurationMs: 0, transitionIn: { type: 'cut', duration_ms: 0 }, transitionOut: { type: 'cut', duration_ms: 0 } };
  }
  const keyShot = shots.find((s) => s.is_key_shot) ?? shots[0];
  const firstShot = shots[0];
  const lastShot = shots[shots.length - 1];

  const calloutStartMs =
    keyShot.callout_start_time != null ? Math.round(keyShot.callout_start_time * 1000) : 0;
  const calloutEndMs =
    keyShot.callout_end_time != null
      ? Math.round(keyShot.callout_end_time * 1000)
      : calloutStartMs + 3000;

  return {
    zoomRegion: keyShot.zoom_region_json as BoundingRegion | null,
    highlightRegion: keyShot.highlight_region_json as BoundingRegion | null,
    calloutTitle: keyShot.callout_title ?? null,
    calloutDesc: keyShot.callout_description ?? null,
    calloutStartMs,
    calloutEndMs,
    calloutDurationMs: calloutEndMs - calloutStartMs,
    transitionIn: mapShotTransition(
      firstShot.transition_in,
      Math.round(firstShot.transition_duration * 1000),
    ),
    transitionOut: mapShotTransition(
      lastShot.transition_out,
      Math.round(lastShot.transition_duration * 1000),
    ),
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildRenderManifest(payload: {
  renderProjectId: string;
  draftId: string;
  draftTitle?: string;
  renderMode: RenderMode;
  renderConfig: RenderConfig;
}): Promise<RenderManifest> {
  const { renderProjectId, draftId, renderMode, renderConfig } = payload;
  const draftTitle = payload.draftTitle ?? '';

  const [scenesRes, narrationRes, assetsRes, captionsRes, shotPlansRes] = await Promise.all([
    supabase
      .from('doc_studio_scenes')
      .select(
        'id, scene_order, title, start_time_seconds, end_time_seconds, duration_seconds, visual_emphasis_json',
      )
      .eq('draft_id', draftId)
      .order('scene_order', { ascending: true }),
    supabase
      .from('doc_studio_narration_segments')
      .select('scene_id, audio_asset_id, timing_json, target_duration_seconds')
      .eq('draft_id', draftId)
      .eq('status', 'ready'),
    supabase
      .from('doc_studio_assets')
      .select('id, scene_id, screenshot_role, file_url, sort_order')
      .eq('draft_id', draftId)
      .eq('asset_status', 'ready')
      .in('asset_type', ['screenshot'])
      .order('sort_order', { ascending: true }),
    supabase
      .from('doc_studio_caption_manifests')
      .select('caption_json')
      .eq('draft_id', draftId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('doc_studio_shot_plans')
      .select('*')
      .eq('draft_id', draftId)
      .order('shot_order', { ascending: true }),
  ]);

  if (scenesRes.error) throw scenesRes.error;

  const scenes = (scenesRes.data ?? []) as SceneRow[];

  const narrationByScene = new Map<string, NarrationRow>();
  ((narrationRes.data ?? []) as NarrationRow[]).forEach((n) => {
    if (n.scene_id) narrationByScene.set(n.scene_id, n);
  });

  const assetsByScene = new Map<string, AssetRow[]>();
  ((assetsRes.data ?? []) as AssetRow[]).forEach((a) => {
    if (a.scene_id) {
      if (!assetsByScene.has(a.scene_id)) assetsByScene.set(a.scene_id, []);
      assetsByScene.get(a.scene_id)!.push(a);
    }
  });

  const captionBlocks = (captionsRes.data?.caption_json ?? []) as CaptionRow[];
  const captionsByScene = new Map<string, CaptionRow[]>();
  captionBlocks.forEach((b) => {
    if (b.scene_id) {
      if (!captionsByScene.has(b.scene_id)) captionsByScene.set(b.scene_id, []);
      captionsByScene.get(b.scene_id)!.push(b);
    }
  });

  const allShotPlans = (shotPlansRes.data ?? []) as DocumentationShotPlan[];
  const shotsByScene = new Map<string, DocumentationShotPlan[]>();
  allShotPlans.forEach((sp) => {
    if (sp.scene_id) {
      if (!shotsByScene.has(sp.scene_id)) shotsByScene.set(sp.scene_id, []);
      shotsByScene.get(sp.scene_id)!.push(sp);
    }
  });
  const hasShotPlans = allShotPlans.length > 0;

  const audioUrls = new Map<string, string>();
  const audioIds = [...narrationByScene.values()]
    .map((n) => n.audio_asset_id)
    .filter(Boolean) as string[];
  if (audioIds.length > 0) {
    const audioRes = await supabase
      .from('doc_studio_assets')
      .select('id, file_url')
      .in('id', audioIds);
    if (!audioRes.error) {
      ((audioRes.data ?? []) as AudioAssetRow[]).forEach((a) => audioUrls.set(a.id, a.file_url));
    }
  }

  let cursor = 0;
  let scenesWithShots = 0;
  let scenesWithoutShots = 0;

  const timelineScenes: RenderTimelineScene[] = scenes.map((scene) => {
    const durationMs = Math.round(getEffectiveSceneRuntime(scene.duration_seconds) * 1000);
    const startMs = cursor;
    const endMs = cursor + durationMs;
    cursor = endMs;

    const sceneAssets = assetsByScene.get(scene.id) ?? [];
    const narration = narrationByScene.get(scene.id);
    const sceneCaptions = captionsByScene.get(scene.id) ?? [];
    const sceneShots = shotsByScene.get(scene.id) ?? [];

    const narrationDurationMs = narration?.target_duration_seconds
      ? Math.round(narration.target_duration_seconds * 1000)
      : durationMs;
    const wordTimings =
      ((narration?.timing_json as Record<string, unknown>)?.words as Array<{
        word: string;
        start_ms: number;
        end_ms: number;
      }>) ?? [];

    const captions = sceneCaptions.map((c) => ({
      text: c.text,
      start_ms: Math.round(c.start_time_seconds * 1000),
      end_ms: Math.round(c.end_time_seconds * 1000),
    }));

    const narrationResult = narration
      ? {
          audio_asset_id: narration.audio_asset_id,
          audio_url: narration.audio_asset_id
            ? (audioUrls.get(narration.audio_asset_id) ?? null)
            : null,
          start_ms: 0,
          duration_ms: narrationDurationMs,
          word_timings: wordTimings,
        }
      : null;

    // ── Shot-plan-driven path (v2.0) ──────────────────────────────────────────
    if (sceneShots.length > 0) {
      scenesWithShots++;
      const kv = extractKeyVisuals(sceneShots);
      const videoSegments = buildVideoSegmentsFromShots(sceneShots, durationMs, startMs);
      const screenshotOverlays = buildScreenshotOverlaysFromShots(
        sceneShots,
        sceneAssets,
        durationMs,
      );

      return {
        scene_id: scene.id,
        scene_order: scene.scene_order,
        title: scene.title,
        start_ms: startMs,
        end_ms: endMs,
        duration_ms: durationMs,
        video_segments: videoSegments,
        screenshot_overlays: screenshotOverlays,
        narration: narrationResult,
        captions,
        callout: kv.calloutTitle
          ? {
              title: kv.calloutTitle,
              description: kv.calloutDesc,
              start_ms: kv.calloutStartMs,
              duration_ms: kv.calloutDurationMs,
            }
          : null,
        zoom_effect: kv.zoomRegion
          ? { region: kv.zoomRegion, start_ms: 0, duration_ms: durationMs }
          : null,
        highlight_effect: kv.highlightRegion
          ? { region: kv.highlightRegion, start_ms: 0, duration_ms: durationMs }
          : null,
        transition_in: kv.transitionIn,
        transition_out: kv.transitionOut,
      } satisfies RenderTimelineScene;
    }

    // ── Scene-only fallback (v1.0 backward compat) ────────────────────────────
    scenesWithoutShots++;
    const emphasis = scene.visual_emphasis_json ?? {};
    const zoomRegion =
      (emphasis as Record<string, unknown>).zoom_region as BoundingRegion | null ?? null;
    const highlightRegion =
      (emphasis as Record<string, unknown>).highlight_region as BoundingRegion | null ?? null;
    const calloutTitle =
      (emphasis as Record<string, unknown>).callout_title as string | null ?? null;
    const calloutDesc =
      (emphasis as Record<string, unknown>).callout_description as string | null ?? null;

    const perOverlayMs =
      sceneAssets.length > 0 ? Math.round(durationMs / sceneAssets.length) : durationMs;
    let overlayCursor = 0;
    const screenshotOverlays = sceneAssets.map((a) => {
      const oms = overlayCursor;
      overlayCursor += perOverlayMs;
      return {
        asset_id: a.id,
        file_url: a.file_url,
        screenshot_role: a.screenshot_role,
        display_start_ms: oms,
        display_end_ms: Math.min(oms + perOverlayMs, durationMs),
        zoom_region: null as BoundingRegion | null,
        highlight_region: null as BoundingRegion | null,
      };
    });

    return {
      scene_id: scene.id,
      scene_order: scene.scene_order,
      title: scene.title,
      start_ms: startMs,
      end_ms: endMs,
      duration_ms: durationMs,
      video_segments: [
        {
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
        },
      ],
      screenshot_overlays: screenshotOverlays,
      narration: narrationResult,
      captions,
      callout: calloutTitle
        ? { title: calloutTitle, description: calloutDesc, start_ms: 0, duration_ms: 3000 }
        : null,
      zoom_effect: zoomRegion ? { region: zoomRegion, start_ms: 0, duration_ms: durationMs } : null,
      highlight_effect: highlightRegion
        ? { region: highlightRegion, start_ms: 0, duration_ms: durationMs }
        : null,
      transition_in: {
        type: renderConfig.transitions.type,
        duration_ms: renderConfig.transitions.duration_ms,
      },
      transition_out: {
        type: renderConfig.transitions.type,
        duration_ms: renderConfig.transitions.duration_ms,
      },
    } satisfies RenderTimelineScene;
  });

  const manifest: RenderManifest = {
    render_project_id: renderProjectId,
    draft_id: draftId,
    draft_title: draftTitle,
    render_mode: renderMode,
    render_config: renderConfig,
    total_duration_ms: cursor,
    scene_count: scenes.length,
    scenes: timelineScenes,
    generated_at: new Date().toISOString(),
    schema_version: hasShotPlans ? '2.0' : '1.0',
    ...(hasShotPlans && {
      shot_plan_metadata: {
        shot_plans_used: true,
        shot_count: allShotPlans.length,
        scenes_with_shot_plans: scenesWithShots,
        scenes_without_shot_plans: scenesWithoutShots,
      },
    }),
  };

  return manifest;
}

export function downloadRenderManifest(manifest: RenderManifest): void {
  const json = JSON.stringify(manifest, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `render-manifest-${manifest.draft_id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

import type { RenderManifest, RenderTimelineScene } from '../../types/documentation';
import type {
  RemotionCompositionProps,
  RemotionSceneProps,
  RemotionVideoSegmentProps,
} from './types';

// ─── Time Utilities ───────────────────────────────────────────────────────────

export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

export function framesToMs(frames: number, fps: number): number {
  return Math.round((frames / fps) * 1000);
}

// ─── Scene Props Builder ──────────────────────────────────────────────────────

export function buildRemotionSceneProps(
  scene: RenderTimelineScene,
  fps: number,
): RemotionSceneProps {
  const startFrame = msToFrames(scene.start_ms, fps);
  const endFrame = msToFrames(scene.end_ms, fps);
  const durationFrames = endFrame - startFrame;

  const segments: RemotionVideoSegmentProps[] = scene.video_segments.map((seg, idx) => {
    const segStartFrame = msToFrames(seg.output_start_ms, fps);
    const segEndFrame = msToFrames(seg.output_end_ms, fps);
    return {
      segmentOrder: seg.segment_order ?? idx,
      sourceAssetId: seg.source_asset_id,
      sourceUrl: null,
      startFrame: segStartFrame,
      endFrame: segEndFrame,
      durationFrames: segEndFrame - segStartFrame,
      playbackSpeed: seg.playback_speed,
      hasZoom: seg.has_zoom,
      hasHighlight: seg.has_highlight,
    };
  });

  return {
    sceneId: scene.scene_id,
    sceneOrder: scene.scene_order,
    title: scene.title,
    startFrame,
    endFrame,
    durationFrames,
    segments,
  };
}

// ─── Composition ID ───────────────────────────────────────────────────────────

export function buildCompositionId(manifest: RenderManifest): string {
  const slug = manifest.draft_title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  const modeSlug = manifest.render_mode.replace(/_/g, '-');
  return `tutorial-${slug}-${modeSlug}`;
}

// ─── Source File Collection ───────────────────────────────────────────────────

export function collectSourceVideoUrls(manifest: RenderManifest): string[] {
  const urls = new Set<string>();
  for (const scene of manifest.scenes) {
    for (const ovl of scene.screenshot_overlays) {
      if (ovl.file_url) urls.add(ovl.file_url);
    }
    if (scene.narration?.audio_url) {
      urls.add(scene.narration.audio_url);
    }
  }
  return Array.from(urls);
}

// ─── Root Composition Props Builder ──────────────────────────────────────────

export function buildRemotionCompositionProps(
  manifest: RenderManifest,
): RemotionCompositionProps {
  const fps = manifest.render_config.video.fps;
  const totalDurationFrames = msToFrames(manifest.total_duration_ms, fps);

  const scenes = manifest.scenes.map(scene =>
    buildRemotionSceneProps(scene, fps),
  );

  return {
    scenes,
    narrationTracks: [],
    captions: [],
    overlays: [],
    callouts: [],
    zoomEffects: [],
    highlights: [],
    transitions: [],
    fps,
    width: manifest.render_config.video.width,
    height: manifest.render_config.video.height,
    totalDurationFrames,
    renderMode: manifest.render_mode,
    draftTitle: manifest.draft_title,
  };
}

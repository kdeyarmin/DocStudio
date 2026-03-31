import type { RenderManifest, RenderTimelineScene } from '../../types/documentation';
import type {
  RemotionNarrationSyncPoint,
  RemotionNarrationTrack,
} from './types';
import { msToFrames } from './compositionPropBuilder';

// ─── Word-Level Sequences ─────────────────────────────────────────────────────

export function buildWordLevelSequences(
  scene: RenderTimelineScene,
  sceneStartFrame: number,
  fps: number,
): RemotionNarrationSyncPoint[] {
  if (!scene.narration?.word_timings?.length) return [];

  return scene.narration.word_timings.map(wt => {
    const absStartFrame = sceneStartFrame + msToFrames(wt.start_ms, fps);
    const absEndFrame = sceneStartFrame + msToFrames(wt.end_ms, fps);
    return {
      word: wt.word,
      startFrame: absStartFrame,
      endFrame: absEndFrame,
    };
  });
}

// ─── Per-Scene Narration Track ────────────────────────────────────────────────

function buildNarrationTrack(
  scene: RenderTimelineScene,
  fps: number,
): RemotionNarrationTrack | null {
  if (!scene.narration) return null;

  const startFrame = msToFrames(scene.narration.start_ms, fps);
  const durationFrames = msToFrames(scene.narration.duration_ms, fps);
  const syncPoints = buildWordLevelSequences(scene, msToFrames(scene.start_ms, fps), fps);

  return {
    sceneId: scene.scene_id,
    sceneOrder: scene.scene_order,
    audioAssetId: scene.narration.audio_asset_id,
    audioUrl: scene.narration.audio_url,
    startFrame,
    durationFrames,
    volume: 1.0,
    syncPoints,
  };
}

// ─── Full Narration Plan ──────────────────────────────────────────────────────

export interface NarrationPlanResult {
  tracks: RemotionNarrationTrack[];
  coveragePercent: number;
  warnings: string[];
}

export function buildNarrationSyncPlan(
  manifest: RenderManifest,
): NarrationPlanResult {
  const fps = manifest.render_config.video.fps;
  const tracks: RemotionNarrationTrack[] = [];
  const warnings: string[] = [];
  let coveredMs = 0;

  for (const scene of manifest.scenes) {
    const track = buildNarrationTrack(scene, fps);
    if (track) {
      tracks.push(track);
      coveredMs += scene.duration_ms;
    } else {
      warnings.push(`Scene "${scene.title}" has no narration audio`);
    }
  }

  const coveragePercent =
    manifest.total_duration_ms > 0
      ? Math.round((coveredMs / manifest.total_duration_ms) * 100)
      : 0;

  if (coveragePercent === 0) {
    warnings.push('No narration audio found — video will be silent');
  } else if (coveragePercent < 50) {
    warnings.push(`Only ${coveragePercent}% of timeline has narration audio`);
  }

  return { tracks, coveragePercent, warnings };
}

// ─── Total Word Count Helper ──────────────────────────────────────────────────

export function countTotalSyncPoints(tracks: RemotionNarrationTrack[]): number {
  return tracks.reduce((sum, t) => sum + t.syncPoints.length, 0);
}

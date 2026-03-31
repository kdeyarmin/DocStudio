import type { RenderCaptionConfig, RenderManifest } from '../../types/documentation';
import type {
  RemotionCaptionCue,
  RemotionCaptionPlan,
  RemotionCaptionStyle,
} from './types';
import { msToFrames } from './compositionPropBuilder';

// ─── Caption Style ────────────────────────────────────────────────────────────

export function buildCaptionStyle(config: RenderCaptionConfig): RemotionCaptionStyle {
  return {
    fontSize: config.font_size,
    position: config.position,
    burnIn: config.burn_in ?? false,
    fontFamily: 'Inter, Arial, sans-serif',
    backgroundColor: 'rgba(0,0,0,0.75)',
    textColor: '#ffffff',
    paddingPx: 12,
    borderRadius: 4,
  };
}

// ─── SRT / VTT Generation ─────────────────────────────────────────────────────

function msToSrtTimestamp(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const f = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(f).padStart(3, '0')}`;
}

function msToVttTimestamp(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const f = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(3, '0')}`;
}

export function buildSrtContent(
  cues: Array<{ index: number; text: string; startMs: number; endMs: number }>,
): string {
  if (cues.length === 0) return '';
  return cues
    .map(
      c =>
        `${c.index}\n${msToSrtTimestamp(c.startMs)} --> ${msToSrtTimestamp(c.endMs)}\n${c.text}\n`,
    )
    .join('\n');
}

export function buildVttContent(
  cues: Array<{ index: number; text: string; startMs: number; endMs: number }>,
): string {
  if (cues.length === 0) return 'WEBVTT\n';
  const body = cues
    .map(
      c =>
        `${msToVttTimestamp(c.startMs)} --> ${msToVttTimestamp(c.endMs)}\n${c.text}\n`,
    )
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

// ─── Caption Coverage ─────────────────────────────────────────────────────────

export function computeCaptionCoveragePercent(
  manifest: RenderManifest,
): number {
  if (manifest.total_duration_ms === 0) return 0;
  let coveredMs = 0;
  for (const scene of manifest.scenes) {
    for (const cap of scene.captions) {
      coveredMs += cap.end_ms - cap.start_ms;
    }
  }
  return Math.min(100, Math.round((coveredMs / manifest.total_duration_ms) * 100));
}

// ─── Full Caption Plan ────────────────────────────────────────────────────────

export function buildCaptionSequences(
  manifest: RenderManifest,
  config: RenderCaptionConfig,
): RemotionCaptionPlan {
  const fps = manifest.render_config.video.fps;
  const style = buildCaptionStyle(config);
  const cues: RemotionCaptionCue[] = [];
  let globalIndex = 1;

  for (const scene of manifest.scenes) {
    for (const cap of scene.captions) {
      const absStartMs = scene.start_ms + cap.start_ms;
      const absEndMs = scene.start_ms + cap.end_ms;
      const startFrame = msToFrames(absStartMs, fps);
      const endFrame = msToFrames(absEndMs, fps);
      cues.push({
        index: globalIndex++,
        text: cap.text,
        startFrame,
        endFrame,
        durationFrames: endFrame - startFrame,
        sceneId: scene.scene_id,
        style,
      });
    }
  }

  const rawCues = cues.map(c => ({
    index: c.index,
    text: c.text,
    startMs: Math.round((c.startFrame / fps) * 1000),
    endMs: Math.round((c.endFrame / fps) * 1000),
  }));

  return {
    cues,
    srtContent: buildSrtContent(rawCues),
    vttContent: buildVttContent(rawCues),
    totalCueCount: cues.length,
    coveragePercent: computeCaptionCoveragePercent(manifest),
  };
}

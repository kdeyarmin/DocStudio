import type {
  DocumentationScene,
  DocumentationNarrationSegment,
  NarrationTimingMetadata,
} from '../../../types/documentation';

export interface SceneAudioEntry {
  scene: DocumentationScene;
  segment: DocumentationNarrationSegment | null;
  audioAssetId: string | null;
  audioDurationSeconds: number;
  displayDurationSeconds: number;
  durationSeconds: number;
  timing: NarrationTimingMetadata | null;
  offsetSeconds: number;
}

export interface AudioTimeline {
  entries: SceneAudioEntry[];
  totalDurationSeconds: number;
  gapSceneIds: string[];
  coveragePct: number;
}

export interface NarrationTimelineSegment {
  sceneId: string;
  scenePosition: number;
  offsetMs: number;
  durationMs: number;
  audioAssetId: string | null;
  narrationText: string;
}

export const DEFAULT_SCENE_DISPLAY_SECONDS = 3;

export function getEffectiveSceneRuntime(
  sceneDurationSeconds: number | null | undefined,
  minimumSceneDisplaySeconds = DEFAULT_SCENE_DISPLAY_SECONDS,
): number {
  const durationSeconds = Math.max(sceneDurationSeconds ?? 0, 0);
  return Math.max(durationSeconds, minimumSceneDisplaySeconds);
}

export function assembleSceneAudioSequence(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
  minimumSceneDisplaySeconds = DEFAULT_SCENE_DISPLAY_SECONDS,
): AudioTimeline {
  const segmentBySceneId = new Map(segments.filter(s => s.scene_id).map(s => [s.scene_id!, s]));
  const entries: SceneAudioEntry[] = [];
  let cumulativeOffset = 0;
  const gapSceneIds: string[] = [];

  for (const scene of scenes) {
    const seg = segmentBySceneId.get(scene.id) ?? null;
    const audioDuration = Math.max(seg?.duration_seconds ?? 0, 0);
    const displayDuration = getEffectiveSceneRuntime(audioDuration, minimumSceneDisplaySeconds);

    entries.push({
      scene,
      segment: seg,
      audioAssetId: seg?.audio_asset_id ?? null,
      audioDurationSeconds: audioDuration,
      displayDurationSeconds: displayDuration,
      durationSeconds: displayDuration,
      timing: (seg?.timing_metadata as NarrationTimingMetadata | null) ?? null,
      offsetSeconds: cumulativeOffset,
    });

    if (!seg?.audio_asset_id) {
      gapSceneIds.push(scene.id);
    }

    cumulativeOffset += displayDuration;
  }

  const totalDurationSeconds = entries.reduce((acc, e) => acc + e.durationSeconds, 0);
  const coveragePct =
    entries.length > 0
      ? Math.round(((entries.length - gapSceneIds.length) / entries.length) * 100)
      : 0;

  return { entries, totalDurationSeconds, gapSceneIds, coveragePct };
}

export function calculateSceneAudioDurations(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
): Map<string, number> {
  const durations = new Map<string, number>();
  const segmentBySceneId = new Map(segments.filter(s => s.scene_id).map(s => [s.scene_id!, s]));

  for (const scene of scenes) {
    const seg = segmentBySceneId.get(scene.id);
    durations.set(scene.id, seg?.duration_seconds ?? 0);
  }

  return durations;
}

export function mergeNarrationMetadata(
  segments: DocumentationNarrationSegment[],
): NarrationTimingMetadata & { totalDurationMs: number } {
  let totalMs = 0;
  const mergedWords: NarrationTimingMetadata['words'] = [];
  let wordOffset = 0;

  for (const seg of segments) {
    const meta = seg.timing_metadata as NarrationTimingMetadata | null;
    if (!meta) continue;

    const segMs = meta.total_duration_ms ?? 0;
    for (const word of meta.words ?? []) {
      mergedWords.push({
        word: word.word,
        start_ms: wordOffset + (word.start_ms ?? 0),
        end_ms: wordOffset + (word.end_ms ?? 0),
      });
    }

    wordOffset += segMs;
    totalMs += segMs;
  }

  return {
    total_duration_ms: totalMs,
    totalDurationMs: totalMs,
    words: mergedWords,
    characters: [],
    alignment_confidence: 0,
    generated_by: 'merged',
  };
}

export function buildNarrationTimeline(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
): NarrationTimelineSegment[] {
  const { entries } = assembleSceneAudioSequence(scenes, segments);

  return entries.map(e => ({
    sceneId: e.scene.id,
    scenePosition: (e.scene as { position?: number }).position ?? 0,
    offsetMs: Math.round(e.offsetSeconds * 1000),
    durationMs: Math.round(e.audioDurationSeconds * 1000),
    audioAssetId: e.audioAssetId,
    narrationText: e.segment?.narration_text ?? '',
  }));
}

export function estimateTotalTutorialRuntime(
  scenes: DocumentationScene[],
  segments: DocumentationNarrationSegment[],
  minimumSceneDisplaySeconds = DEFAULT_SCENE_DISPLAY_SECONDS,
): number {
  const { totalDurationSeconds } = assembleSceneAudioSequence(
    scenes,
    segments,
    minimumSceneDisplaySeconds,
  );
  return Math.ceil(totalDurationSeconds);
}

export function estimateDurationFromText(text: string, wpm = 140): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((wordCount / wpm) * 60 * 10) / 10);
}

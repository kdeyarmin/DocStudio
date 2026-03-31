import type { RenderManifest, RenderTimelineScene } from '../../types/documentation';
import type { FfmpegSceneCommand, FfmpegSegmentClip } from './types';

function msToSeconds(ms: number): number {
  return ms / 1000;
}

function buildSpeedFilters(speed: number, videoLabel: string, audioLabel: string): string[] {
  if (speed === 1.0) return [];

  const setpts = `[${videoLabel}]setpts=${(1 / speed).toFixed(6)}*PTS[${videoLabel}s]`;

  const filters: string[] = [setpts];

  if (speed <= 2.0) {
    filters.push(`[${audioLabel}]atempo=${speed.toFixed(4)}[${audioLabel}s]`);
  } else if (speed <= 4.0) {
    const half = Math.sqrt(speed).toFixed(4);
    filters.push(`[${audioLabel}]atempo=${half},atempo=${half}[${audioLabel}s]`);
  } else {
    const part = Math.cbrt(speed).toFixed(4);
    filters.push(`[${audioLabel}]atempo=${part},atempo=${part},atempo=${part}[${audioLabel}s]`);
  }

  return filters;
}

function buildSceneSegments(
  scene: RenderTimelineScene,
  baseInputIndex: number,
  sceneIndex: number,
): { segments: FfmpegSegmentClip[]; nextInputIndex: number } {
  const segments: FfmpegSegmentClip[] = [];
  let inputIdx = baseInputIndex;

  for (let si = 0; si < scene.video_segments.length; si++) {
    const seg = scene.video_segments[si];
    const videoLabel = `v_s${sceneIndex}_seg${si}`;
    const audioLabel = `a_s${sceneIndex}_seg${si}`;

    const seekSeconds = msToSeconds(seg.source_start_ms);
    const toSeconds = msToSeconds(seg.source_end_ms);
    const durationSeconds = Math.max(0, toSeconds - seekSeconds);

    const speedFilters = buildSpeedFilters(seg.playback_speed, videoLabel, audioLabel);

    const effectiveVideoLabel = seg.playback_speed !== 1.0 ? `${videoLabel}s` : videoLabel;
    const effectiveAudioLabel = seg.playback_speed !== 1.0 ? `${audioLabel}s` : audioLabel;

    segments.push({
      inputIndex: inputIdx,
      sourceFile: `__asset_${seg.source_asset_id ?? 'missing'}__`,
      seekSeconds,
      toSeconds,
      durationSeconds,
      playbackSpeed: seg.playback_speed,
      outputVideoLabel: effectiveVideoLabel,
      outputAudioLabel: effectiveAudioLabel,
      speedFilterFragments: speedFilters,
    });

    inputIdx++;
  }

  return { segments, nextInputIndex: inputIdx };
}

export function buildFfmpegSceneCommands(manifest: RenderManifest): FfmpegSceneCommand[] {
  const commands: FfmpegSceneCommand[] = [];
  let nextInputIndex = 0;

  for (let si = 0; si < manifest.scenes.length; si++) {
    const scene = manifest.scenes[si];

    const { segments, nextInputIndex: nextIdx } = buildSceneSegments(scene, nextInputIndex, si);
    nextInputIndex = nextIdx;

    const finalVideoLabel =
      segments.length === 1
        ? segments[0].outputVideoLabel
        : `v_scene${si}_concat`;

    const finalAudioLabel =
      segments.length === 1
        ? segments[0].outputAudioLabel
        : `a_scene${si}_concat`;

    commands.push({
      sceneId: scene.scene_id,
      sceneOrder: scene.scene_order,
      segments,
      outputVideoLabel: finalVideoLabel,
      outputAudioLabel: finalAudioLabel,
    });
  }

  return commands;
}

export function buildSceneConcatFilterLines(commands: FfmpegSceneCommand[]): string[] {
  const lines: string[] = [];

  for (const cmd of commands) {
    if (cmd.segments.length <= 1) continue;

    const videoInputs = cmd.segments.map(s => `[${s.outputVideoLabel}]`).join('');
    const audioInputs = cmd.segments.map(s => `[${s.outputAudioLabel}]`).join('');
    const n = cmd.segments.length;

    lines.push(
      `${videoInputs}${audioInputs}concat=n=${n}:v=1:a=1[${cmd.outputVideoLabel}][${cmd.outputAudioLabel}]`,
    );
  }

  return lines;
}

export function collectSourceFiles(commands: FfmpegSceneCommand[]): string[] {
  const files: string[] = [];
  for (const cmd of commands) {
    for (const seg of cmd.segments) {
      files.push(seg.sourceFile);
    }
  }
  return files;
}

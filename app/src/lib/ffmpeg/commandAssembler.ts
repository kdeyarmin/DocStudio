import type { RenderConfig } from '../../types/documentation';
import type {
  FfmpegAudioMixPlan,
  FfmpegCommandPlan,
  FfmpegFinalizePlan,
  FfmpegOutputFlags,
  FfmpegOverlayGraph,
  FfmpegSceneCommand,
  FfmpegSubtitlePlan,
  FfmpegTransitionEntry,
} from './types';
import { buildSceneConcatFilterLines, collectSourceFiles } from './sceneCommandBuilder';
import { buildTransitionFilterLines, getFinalTransitionLabel } from './transitionPlanner';

function resolveCodec(codec: RenderConfig['video']['codec']): string {
  switch (codec) {
    case 'vp9': return 'libvpx-vp9';
    case 'av1': return 'libaom-av1';
    default: return 'libx264';
  }
}

function buildOutputFlags(config: RenderConfig): FfmpegOutputFlags {
  const { video } = config;
  return {
    videoCodec: resolveCodec(video.codec),
    bitrateKbps: video.bitrate_kbps ?? (video.width >= 3840 ? 20000 : video.width >= 1920 ? 8000 : 4000),
    audioCodec: 'aac',
    audioBitrateKbps: 192,
    fps: video.fps,
    width: video.width,
    height: video.height,
    pixelFormat: 'yuv420p',
    movFlags: '+faststart',
    preset: 'medium',
    crf: video.width >= 3840 ? 22 : 20,
  };
}

function simpleFingerprint(parts: string[]): string {
  let h = 0;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h = ((h << 5) - h + part.charCodeAt(i)) | 0;
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function buildFilterComplex(
  sceneCommands: FfmpegSceneCommand[],
  overlayGraph: FfmpegOverlayGraph,
  audioMixPlan: FfmpegAudioMixPlan,
  subtitlePlan: FfmpegSubtitlePlan,
  transitions: FfmpegTransitionEntry[],
): { lines: string[]; finalVideoLabel: string; finalAudioLabel: string } {
  const lines: string[] = [];

  for (const cmd of sceneCommands) {
    for (const seg of cmd.segments) {
      if (seg.speedFilterFragments.length > 0) {
        lines.push(...seg.speedFilterFragments);
      }
    }
  }

  const concatLines = buildSceneConcatFilterLines(sceneCommands);
  lines.push(...concatLines);

  const sceneVideoLabels = sceneCommands.map(c => c.outputVideoLabel);
  const overlaidSceneVideoLabels = overlayGraph.finalSceneVideoLabels.length > 0
    ? overlayGraph.finalSceneVideoLabels
    : sceneVideoLabels;
  const sceneAudioLabels = sceneCommands.map(c => c.outputAudioLabel);

  for (const instr of overlayGraph.instructions) {
    lines.push(instr.filterFragment);
  }

  const transitionLines = buildTransitionFilterLines(transitions, overlaidSceneVideoLabels);
  lines.push(...transitionLines);

  const currentVideoLabel = getFinalTransitionLabel(transitions, overlaidSceneVideoLabels);

  let finalVideoLabel = currentVideoLabel;

  if (subtitlePlan.burnInFilterString) {
    const burnInOutputLabel = 'v_with_subs';
    const burnIn = subtitlePlan.burnInFilterString.replace(
      /\[([^\]]+)\]ass=/,
      `[${currentVideoLabel}]ass=`,
    );
    lines.push(burnIn);
    finalVideoLabel = burnInOutputLabel;
  }

  const audioLines = audioMixPlan.mixFilterString.split(';').filter(Boolean);
  lines.push(...audioLines);
  if (audioMixPlan.normalizationFilter) {
    lines.push(audioMixPlan.normalizationFilter);
  }

  void sceneAudioLabels;

  return {
    lines,
    finalVideoLabel,
    finalAudioLabel: audioMixPlan.finalAudioLabel,
  };
}

export function assembleFfmpegCommandPlan(
  jobId: string,
  draftId: string,
  renderProjectId: string,
  sceneCommands: FfmpegSceneCommand[],
  overlayGraph: FfmpegOverlayGraph,
  audioMixPlan: FfmpegAudioMixPlan,
  subtitlePlan: FfmpegSubtitlePlan,
  transitions: FfmpegTransitionEntry[],
  config: RenderConfig,
  totalDurationMs: number,
): FfmpegCommandPlan {
  const sourceFiles = collectSourceFiles(sceneCommands);
  const narrationFiles = audioMixPlan.tracks.map(t => t.audioFile);
  const extraFiles = overlayGraph.extraInputFiles;

  const allInputFiles = [...sourceFiles, ...narrationFiles, ...extraFiles];

  const { lines: filterComplexLines, finalVideoLabel, finalAudioLabel } = buildFilterComplex(
    sceneCommands,
    overlayGraph,
    audioMixPlan,
    subtitlePlan,
    transitions,
  );

  const outputFlags = buildOutputFlags(config);

  const sceneIds = sceneCommands.map(c => c.sceneId).sort();
  const fingerprintHash = simpleFingerprint([
    ...sceneIds,
    JSON.stringify(config),
    draftId,
  ]);

  return {
    jobId,
    draftId,
    renderProjectId,
    fingerprintHash,
    sceneCommands,
    overlayGraph,
    audioMixPlan,
    subtitlePlan,
    transitions,
    allInputFiles,
    filterComplexLines,
    finalVideoLabel,
    finalAudioLabel,
    outputFlags,
    estimatedDurationSeconds: totalDurationMs / 1000,
    createdAt: new Date().toISOString(),
  };
}

export function buildFfmpegCliArgs(plan: FfmpegCommandPlan, outputPath: string): string[] {
  const args: string[] = [];

  for (const file of plan.allInputFiles) {
    args.push('-i', file);
  }

  if (plan.filterComplexLines.length > 0) {
    args.push('-filter_complex', plan.filterComplexLines.join(';'));
    args.push('-map', `[${plan.finalVideoLabel}]`);
    args.push('-map', `[${plan.finalAudioLabel}]`);
  } else {
    args.push('-map', '0:v:0');
    args.push('-map', '0:a:0');
  }

  const f = plan.outputFlags;
  args.push(
    '-c:v', f.videoCodec,
    '-b:v', `${f.bitrateKbps}k`,
    '-crf', f.crf.toString(),
    '-preset', f.preset,
    '-pix_fmt', f.pixelFormat,
    '-r', f.fps.toString(),
    '-s', `${f.width}x${f.height}`,
    '-c:a', f.audioCodec,
    '-b:a', `${f.audioBitrateKbps}k`,
    '-movflags', f.movFlags,
    '-y',
    outputPath,
  );

  return args;
}

export function buildThumbnailCliArgs(inputPath: string, outputPath: string): string[] {
  return ['-ss', '2', '-i', inputPath, '-frames:v', '1', '-q:v', '2', '-y', outputPath];
}

export function buildPreviewCliArgs(
  inputPath: string,
  outputPath: string,
  previewDurationSeconds = 30,
): string[] {
  return [
    '-i', inputPath,
    '-t', previewDurationSeconds.toString(),
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-s', '1280x720',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];
}

export function buildFinalizePlan(
  plan: FfmpegCommandPlan,
  draftSlug: string,
  organizationId: string,
): FfmpegFinalizePlan {
  const base = `/tmp/render_${plan.jobId}`;
  const storageBase = `organizations/${organizationId}/renders/${plan.draftId}/${plan.jobId}`;

  const mainOutputPath = `${base}_output.mp4`;
  const thumbnailPath = `${base}_thumb.jpg`;
  const previewPath = `${base}_preview.mp4`;

  const thumbnailCommand = buildThumbnailCliArgs(mainOutputPath, thumbnailPath);
  const previewCommand = buildPreviewCliArgs(mainOutputPath, previewPath);

  const subtitleFiles: FfmpegFinalizePlan['subtitleFiles'] = [
    {
      path: plan.subtitlePlan.tmpSrtPath,
      content: plan.subtitlePlan.srtContent,
      mimeType: 'text/plain',
    },
    {
      path: plan.subtitlePlan.tmpVttPath,
      content: plan.subtitlePlan.vttContent,
      mimeType: 'text/vtt',
    },
  ];

  if (plan.subtitlePlan.assContent && plan.subtitlePlan.tmpAssPath) {
    subtitleFiles.push({
      path: plan.subtitlePlan.tmpAssPath,
      content: plan.subtitlePlan.assContent,
      mimeType: 'text/plain',
    });
  }

  void draftSlug;

  return {
    mainOutputPath,
    thumbnailCommand,
    previewCommand,
    subtitleFiles,
    storageBasePath: storageBase,
  };
}

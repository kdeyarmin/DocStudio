import type { RenderConfig, RenderManifest } from '../../types/documentation';
import type { FfmpegSubtitleCue, FfmpegSubtitlePlan } from './types';

function padTwoDigits(n: number): string {
  return n.toString().padStart(2, '0');
}

function msToSrtTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)},${millis.toString().padStart(3, '0')}`;
}

function msToVttTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}.${millis.toString().padStart(3, '0')}`;
}

function msToAssTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${hours}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}.${padTwoDigits(cs)}`;
}

function buildSrtContent(cues: FfmpegSubtitleCue[]): string {
  return cues
    .map(
      cue =>
        `${cue.index}\n${msToSrtTimestamp(cue.startMs)} --> ${msToSrtTimestamp(cue.endMs)}\n${cue.text}\n`,
    )
    .join('\n');
}

function buildVttContent(cues: FfmpegSubtitleCue[]): string {
  const lines = ['WEBVTT', ''];
  for (const cue of cues) {
    lines.push(`${cue.index}`);
    lines.push(`${msToVttTimestamp(cue.startMs)} --> ${msToVttTimestamp(cue.endMs)}`);
    lines.push(cue.text);
    lines.push('');
  }
  return lines.join('\n');
}

function buildAssContent(cues: FfmpegSubtitleCue[], config: RenderConfig): string {
  const fontSize = config.captions.font_size;
  const alignment = config.captions.position === 'top' ? 8 : 2;

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,${alignment},10,10,30,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const events = cues
    .map(cue => `Dialogue: 0,${msToAssTimestamp(cue.startMs)},${msToAssTimestamp(cue.endMs)},Default,,0,0,0,,${cue.text}`)
    .join('\n');

  return `${header}\n${events}\n`;
}

function buildBurnInFilter(tmpAssPath: string, videoLabel: string, outputLabel: string): string {
  const escapedPath = tmpAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  return `[${videoLabel}]ass='${escapedPath}'[${outputLabel}]`;
}

export function buildFfmpegSubtitlePlan(
  manifest: RenderManifest,
  config: RenderConfig,
  videoInputLabel: string,
  videoOutputLabel: string,
  jobId: string,
): FfmpegSubtitlePlan {
  const cues: FfmpegSubtitleCue[] = [];
  let index = 1;

  for (const scene of manifest.scenes) {
    for (const caption of scene.captions) {
      if (!caption.text.trim()) continue;
      cues.push({
        index,
        startMs: scene.start_ms + caption.start_ms,
        endMs: scene.start_ms + caption.end_ms,
        text: caption.text,
      });
      index++;
    }
  }

  const srtContent = buildSrtContent(cues);
  const vttContent = buildVttContent(cues);

  const tmpBase = `/tmp/doc_studio_${jobId}`;
  const tmpSrtPath = `${tmpBase}.srt`;
  const tmpVttPath = `${tmpBase}.vtt`;

  if (!config.captions.enabled || cues.length === 0) {
    return {
      cues,
      srtContent,
      vttContent,
      assContent: null,
      burnInFilterString: null,
      tmpSrtPath,
      tmpVttPath,
      tmpAssPath: null,
    };
  }

  const assContent = buildAssContent(cues, config);
  const tmpAssPath = `${tmpBase}.ass`;

  let burnInFilterString: string | null = null;
  if (config.captions.burn_in) {
    burnInFilterString = buildBurnInFilter(tmpAssPath, videoInputLabel, videoOutputLabel);
  }

  return {
    cues,
    srtContent,
    vttContent,
    assContent,
    burnInFilterString,
    tmpSrtPath,
    tmpVttPath,
    tmpAssPath,
  };
}

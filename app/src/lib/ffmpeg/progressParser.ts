import type { FfmpegProgressFrame } from './types';

const PROGRESS_RE =
  /frame=\s*(\d+)\s+fps=\s*([\d.]+)\s+.*?size=\s*[\d\w]+\s+time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})\s+bitrate=\s*([\d.]+)kbits\/s.*?speed=\s*([\d.]+)x/;

function parseTimeToSeconds(h: string, m: string, s: string, cs: string): number {
  return (
    parseInt(h, 10) * 3600 +
    parseInt(m, 10) * 60 +
    parseInt(s, 10) +
    parseInt(cs, 10) / 100
  );
}

export function parseFfmpegStderrLine(
  line: string,
  totalDurationMs: number,
): FfmpegProgressFrame | null {
  const match = PROGRESS_RE.exec(line);
  if (!match) return null;

  const [, frameStr, fpsStr, hStr, mStr, sStr, csStr, bitrateStr, speedStr] = match;

  const frame = parseInt(frameStr, 10);
  const fps = parseFloat(fpsStr);
  const timeSeconds = parseTimeToSeconds(hStr, mStr, sStr, csStr);
  const bitrateKbps = parseFloat(bitrateStr);
  const speed = parseFloat(speedStr);

  const totalDurationSeconds = totalDurationMs / 1000;
  const progressPercent =
    totalDurationSeconds > 0
      ? Math.min(99, Math.round((timeSeconds / totalDurationSeconds) * 100))
      : 0;

  return {
    frame,
    fps,
    timeSeconds,
    bitrateKbps,
    speed,
    progressPercent,
    rawLine: line,
  };
}

export function parseProgressLines(
  stderr: string,
  totalDurationMs: number,
): FfmpegProgressFrame[] {
  return stderr
    .split('\n')
    .map(line => parseFfmpegStderrLine(line.trim(), totalDurationMs))
    .filter((f): f is FfmpegProgressFrame => f !== null);
}

export function getLatestProgressFrame(
  frames: FfmpegProgressFrame[],
): FfmpegProgressFrame | null {
  if (frames.length === 0) return null;
  return frames[frames.length - 1];
}

import type { RemotionProgressFrame, RemotionStitchStage } from './types';

// ─── Step Label Mapping ───────────────────────────────────────────────────────

export function estimateCurrentStep(frame: RemotionProgressFrame): string {
  if (frame.stitchStage === 'done') {
    return 'Render complete';
  }
  if (frame.stitchStage === 'muxing') {
    return 'Muxing audio and video tracks';
  }
  if (frame.stitchStage === 'encoding') {
    return `Encoding output video (${frame.encodedFrames}/${frame.totalFrames} frames)`;
  }
  if (frame.totalFrames > 0 && frame.renderedFrames < frame.totalFrames) {
    return `Rendering frame ${frame.renderedFrames}/${frame.totalFrames}`;
  }
  return 'Preparing render';
}

// ─── Progress Mapper ──────────────────────────────────────────────────────────

export function mapRemotionProgressToFrame(
  renderedFrames: number,
  encodedFrames: number,
  totalFrames: number,
  stitchStage: RemotionStitchStage,
  currentSceneTitle?: string,
): RemotionProgressFrame {
  let progressPercent: number;
  let rawProgress: number;

  if (totalFrames === 0) {
    progressPercent = 0;
    rawProgress = 0;
  } else if (stitchStage === 'encoding' || stitchStage === 'muxing') {
    const renderPct = renderedFrames / totalFrames;
    const encodePct = encodedFrames / totalFrames;
    rawProgress = renderPct * 0.5 + encodePct * 0.4;
    progressPercent = Math.min(90, Math.round(rawProgress * 100));
  } else if (stitchStage === 'done') {
    rawProgress = 1.0;
    progressPercent = 99;
  } else {
    rawProgress = renderedFrames / totalFrames;
    progressPercent = Math.min(50, Math.round(rawProgress * 50));
  }

  const frame: RemotionProgressFrame = {
    renderedFrames,
    encodedFrames,
    totalFrames,
    progressPercent,
    stitchStage,
    currentScene: currentSceneTitle ?? null,
    currentStep: '',
    rawProgress,
  };

  frame.currentStep = estimateCurrentStep(frame);
  return frame;
}

// ─── Latest Frame Helper ──────────────────────────────────────────────────────

export function getLatestProgressFrame(
  frames: RemotionProgressFrame[],
): RemotionProgressFrame | null {
  if (frames.length === 0) return null;
  return frames[frames.length - 1];
}

// ─── ETA Estimation ───────────────────────────────────────────────────────────

export function estimateRenderEtaSeconds(
  frame: RemotionProgressFrame,
  elapsedSeconds: number,
): number | null {
  if (frame.rawProgress <= 0 || elapsedSeconds <= 0) return null;
  const totalEstimated = elapsedSeconds / frame.rawProgress;
  return Math.max(0, Math.round(totalEstimated - elapsedSeconds));
}

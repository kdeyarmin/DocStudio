import type { RenderConfig, RenderManifest } from '../../types/documentation';
import type {
  RemotionCalloutProps,
  RemotionCaptionCue,
  RemotionCompositionPlan,
  RemotionCompositionProps,
  RemotionFinalizePlan,
  RemotionHighlightProps,
  RemotionNarrationTrack,
  RemotionOverlayProps,
  RemotionSubtitleFile,
  RemotionTransitionProps,
  RemotionZoomProps,
} from './types';
import { buildCompositionId, msToFrames } from './compositionPropBuilder';

// ─── Fingerprint Hash (djb2) ──────────────────────────────────────────────────

export function buildCompositionFingerprint(
  manifest: RenderManifest,
  config: RenderConfig,
): string {
  const parts = [
    manifest.draft_id,
    manifest.render_mode,
    String(config.video.width),
    String(config.video.height),
    String(config.video.fps),
    config.video.codec,
    ...manifest.scenes.map(s => `${s.scene_id}:${s.duration_ms}`),
  ];
  const raw = parts.join('|');
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── Finalize Plan ────────────────────────────────────────────────────────────

export function buildRemotionFinalizePlan(
  plan: RemotionCompositionPlan,
  draftSlug: string,
  organizationId: string,
): RemotionFinalizePlan {
  const storageBasePath = `organizations/${organizationId}/renders/${plan.draftId}/${plan.jobId}`;

  const subtitleFiles: RemotionSubtitleFile[] = [];
  if (plan.captionSrtContent) {
    subtitleFiles.push({
      fileName: `${draftSlug}.srt`,
      content: plan.captionSrtContent,
      mimeType: 'text/plain',
    });
  }
  if (plan.captionVttContent) {
    subtitleFiles.push({
      fileName: `${draftSlug}.vtt`,
      content: plan.captionVttContent,
      mimeType: 'text/vtt',
    });
  }

  const fps = plan.fps;
  const previewMaxMs = 30_000;
  const previewDurationFrames = Math.min(
    plan.estimatedFrameCount,
    msToFrames(previewMaxMs, fps),
  );

  return {
    compositionId: plan.compositionId,
    draftSlug,
    organizationId,
    storageBasePath,
    mainOutputFileName: `${draftSlug}-${plan.renderInputProps.renderMode}.mp4`,
    previewOutputFileName: `${draftSlug}-preview.mp4`,
    thumbnailOutputFileName: `${draftSlug}-thumb.jpg`,
    thumbnailCaptureAtFrame: Math.min(60, Math.floor(fps * 2)),
    previewDurationFrames,
    previewWidth: 1280,
    previewHeight: 720,
    subtitleFiles,
  };
}

// ─── Input Props Builder ──────────────────────────────────────────────────────

export function buildRemotionInputProps(
  baseProps: RemotionCompositionProps,
  narrationTracks: RemotionNarrationTrack[],
  captionCues: RemotionCaptionCue[],
  overlays: RemotionOverlayProps[],
  callouts: RemotionCalloutProps[],
  zoomEffects: RemotionZoomProps[],
  highlights: RemotionHighlightProps[],
  transitions: RemotionTransitionProps[],
): RemotionCompositionProps {
  return {
    ...baseProps,
    narrationTracks,
    captions: captionCues,
    overlays,
    callouts,
    zoomEffects,
    highlights,
    transitions,
  };
}

// ─── Full Plan Assembler ──────────────────────────────────────────────────────

export function assembleRemotionCompositionPlan(
  jobId: string,
  draftId: string,
  renderProjectId: string,
  manifest: RenderManifest,
  baseCompositionProps: RemotionCompositionProps,
  narrationTracks: RemotionNarrationTrack[],
  captionCues: RemotionCaptionCue[],
  captionSrtContent: string,
  captionVttContent: string,
  overlays: RemotionOverlayProps[],
  callouts: RemotionCalloutProps[],
  zoomEffects: RemotionZoomProps[],
  highlights: RemotionHighlightProps[],
  transitions: RemotionTransitionProps[],
  config: RenderConfig,
): RemotionCompositionPlan {
  const fps = config.video.fps;
  const compositionId = buildCompositionId(manifest);
  const fingerprintHash = buildCompositionFingerprint(manifest, config);
  const estimatedFrameCount = msToFrames(manifest.total_duration_ms, fps);

  const renderInputProps = buildRemotionInputProps(
    baseCompositionProps,
    narrationTracks,
    captionCues,
    overlays,
    callouts,
    zoomEffects,
    highlights,
    transitions,
  );

  return {
    jobId,
    draftId,
    renderProjectId,
    fingerprintHash,
    compositionId,
    compositionProps: renderInputProps,
    renderInputProps,
    estimatedFrameCount,
    fps,
    width: config.video.width,
    height: config.video.height,
    captionSrtContent,
    captionVttContent,
    createdAt: new Date().toISOString(),
  };
}

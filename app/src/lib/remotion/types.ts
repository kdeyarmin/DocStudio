import type { RenderConfig, RenderManifest, ScreenshotRole } from '../../types/documentation';

// ─── Frame-Level Scene Props ──────────────────────────────────────────────────

export interface RemotionVideoSegmentProps {
  segmentOrder: number;
  sourceAssetId: string | null;
  sourceUrl: string | null;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  playbackSpeed: number;
  hasZoom: boolean;
  hasHighlight: boolean;
}

export interface RemotionSceneProps {
  sceneId: string;
  sceneOrder: number;
  title: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  segments: RemotionVideoSegmentProps[];
}

// ─── Narration Sync ───────────────────────────────────────────────────────────

export interface RemotionNarrationSyncPoint {
  word: string;
  startFrame: number;
  endFrame: number;
}

export interface RemotionNarrationTrack {
  sceneId: string;
  sceneOrder: number;
  audioAssetId: string | null;
  audioUrl: string | null;
  startFrame: number;
  durationFrames: number;
  volume: number;
  syncPoints: RemotionNarrationSyncPoint[];
}

// ─── Captions ─────────────────────────────────────────────────────────────────

export interface RemotionCaptionStyle {
  fontSize: number;
  position: 'bottom' | 'top';
  burnIn: boolean;
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  paddingPx: number;
  borderRadius: number;
}

export interface RemotionCaptionCue {
  index: number;
  text: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  sceneId: string;
  style: RemotionCaptionStyle;
}

export interface RemotionCaptionPlan {
  cues: RemotionCaptionCue[];
  srtContent: string;
  vttContent: string;
  totalCueCount: number;
  coveragePercent: number;
}

// ─── Screenshot Overlays ──────────────────────────────────────────────────────

export interface RemotionOverlayProps {
  assetId: string;
  fileUrl: string | null;
  screenshotRole: ScreenshotRole;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  sceneId: string;
  zoomRegion: { x: number; y: number; width: number; height: number } | null;
  highlightRegion: { x: number; y: number; width: number; height: number } | null;
  transitionType: string | null;
  opacity: number;
}

// ─── Callouts ─────────────────────────────────────────────────────────────────

export type RemotionCalloutAnimation = 'fade' | 'slide' | 'pop' | 'none';
export type RemotionCalloutStyle = 'rounded' | 'pill' | 'box';

export interface RemotionCalloutProps {
  sceneId: string;
  title: string;
  description: string | null;
  startFrame: number;
  durationFrames: number;
  animationStyle: RemotionCalloutAnimation;
  boxStyle: RemotionCalloutStyle;
  fadeInFrames: number;
  fadeOutFrames: number;
}

// ─── Zoom Effects ─────────────────────────────────────────────────────────────

export interface RemotionSpringConfig {
  damping: number;
  mass: number;
  stiffness: number;
  overshootClamping: boolean;
}

export interface RemotionZoomProps {
  sceneId: string;
  region: { x: number; y: number; width: number; height: number };
  startFrame: number;
  durationFrames: number;
  zoomInFrames: number;
  holdFrames: number;
  zoomOutFrames: number;
  springConfig: RemotionSpringConfig;
}

// ─── Highlight Effects ────────────────────────────────────────────────────────

export interface RemotionHighlightProps {
  sceneId: string;
  region: { x: number; y: number; width: number; height: number };
  startFrame: number;
  durationFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  color: string;
  opacity: number;
  borderWidth: number;
}

// ─── Transitions ──────────────────────────────────────────────────────────────

export type RemotionTransitionType = 'cut' | 'crossfade' | 'fade' | 'slide';
export type RemotionSlideDirection = 'left' | 'right' | 'up' | 'down';

export interface RemotionTransitionProps {
  fromSceneId: string;
  toSceneId: string;
  type: RemotionTransitionType;
  durationFrames: number;
  overlapStartFrame: number;
  overlapEndFrame: number;
  springConfig: RemotionSpringConfig | null;
  slideDirection: RemotionSlideDirection | null;
}

// ─── Root Composition Props ───────────────────────────────────────────────────

export interface RemotionCompositionProps {
  scenes: RemotionSceneProps[];
  narrationTracks: RemotionNarrationTrack[];
  captions: RemotionCaptionCue[];
  overlays: RemotionOverlayProps[];
  callouts: RemotionCalloutProps[];
  zoomEffects: RemotionZoomProps[];
  highlights: RemotionHighlightProps[];
  transitions: RemotionTransitionProps[];
  fps: number;
  width: number;
  height: number;
  totalDurationFrames: number;
  renderMode: string;
  draftTitle: string;
}

// ─── Full Composition Plan (persisted to DB) ──────────────────────────────────

export interface RemotionCompositionPlan {
  jobId: string;
  draftId: string;
  renderProjectId: string;
  fingerprintHash: string;
  compositionId: string;
  compositionProps: RemotionCompositionProps;
  renderInputProps: RemotionCompositionProps;
  estimatedFrameCount: number;
  fps: number;
  width: number;
  height: number;
  captionSrtContent: string;
  captionVttContent: string;
  createdAt: string;
}

// ─── Finalize Plan ────────────────────────────────────────────────────────────

export interface RemotionSubtitleFile {
  fileName: string;
  content: string;
  mimeType: string;
}

export interface RemotionFinalizePlan {
  compositionId: string;
  draftSlug: string;
  organizationId: string;
  storageBasePath: string;
  mainOutputFileName: string;
  previewOutputFileName: string;
  thumbnailOutputFileName: string;
  thumbnailCaptureAtFrame: number;
  previewDurationFrames: number;
  previewWidth: number;
  previewHeight: number;
  subtitleFiles: RemotionSubtitleFile[];
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type RemotionStitchStage = 'encoding' | 'muxing' | 'done' | 'idle';

export interface RemotionProgressFrame {
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  progressPercent: number;
  stitchStage: RemotionStitchStage;
  currentScene: string | null;
  currentStep: string;
  rawProgress: number;
}

// ─── Edge Function Shapes ─────────────────────────────────────────────────────

export interface RemotionExecutorStartPayload {
  jobId: string;
  compositionPlan: RemotionCompositionPlan;
  finalizePlan: RemotionFinalizePlan;
  renderConfig: RenderConfig;
  manifest: RenderManifest;
}

export interface RemotionExecutorProgressResponse {
  jobId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'idle';
  progressPercent: number;
  currentStep: string;
  lastFrame: RemotionProgressFrame | null;
  errorMessage: string | null;
}

export interface RemotionExecutorCancelResponse {
  jobId: string;
  cancelled: boolean;
}

export interface RemotionExecutorFinalizeResponse {
  success: boolean;
  videoUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  srtUrl: string | null;
  vttUrl: string | null;
  videoSizeBytes: number | null;
  previewSizeBytes: number | null;
  thumbnailSizeBytes: number | null;
  srtSizeBytes: number | null;
  vttSizeBytes: number | null;
  error: string | null;
}

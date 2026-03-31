import type { RenderConfig, RenderManifest } from '../../types/documentation';

// ─── Scene Trim ───────────────────────────────────────────────────────────────

export interface FfmpegSceneCommand {
  sceneId: string;
  sceneOrder: number;
  segments: FfmpegSegmentClip[];
  outputVideoLabel: string;
  outputAudioLabel: string;
}

export interface FfmpegSegmentClip {
  inputIndex: number;
  sourceFile: string;
  seekSeconds: number;
  toSeconds: number;
  durationSeconds: number;
  playbackSpeed: number;
  outputVideoLabel: string;
  outputAudioLabel: string;
  speedFilterFragments: string[];
}

// ─── Overlay Graph ────────────────────────────────────────────────────────────

export type OverlayKind = 'screenshot' | 'zoom_box' | 'highlight_box' | 'callout_text';

export interface FfmpegOverlayInstruction {
  kind: OverlayKind;
  sceneId: string;
  inputLabel: string;
  outputLabel: string;
  filterFragment: string;
  enableExpression: string;
  layerOrder: number;
}

export interface FfmpegOverlayGraph {
  instructions: FfmpegOverlayInstruction[];
  extraInputFiles: string[];
  finalSceneVideoLabels: string[];
}

// ─── Audio Mix ────────────────────────────────────────────────────────────────

export interface FfmpegAudioTrack {
  inputIndex: number;
  audioFile: string;
  adelayMs: number;
  volume: number;
  sceneId: string;
  outputLabel: string;
}

export interface FfmpegBgmSlot {
  inputIndex: number | null;
  audioFile: string | null;
  volume: number;
  duckingEnabled: boolean;
  duckingTargetDb: number;
}

export interface FfmpegAudioMixPlan {
  tracks: FfmpegAudioTrack[];
  bgm: FfmpegBgmSlot;
  mixFilterString: string;
  normalizationFilter: string;
  finalAudioLabel: string;
}

// ─── Subtitles ────────────────────────────────────────────────────────────────

export interface FfmpegSubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface FfmpegSubtitlePlan {
  cues: FfmpegSubtitleCue[];
  srtContent: string;
  vttContent: string;
  assContent: string | null;
  burnInFilterString: string | null;
  tmpSrtPath: string;
  tmpVttPath: string;
  tmpAssPath: string | null;
}

// ─── Transitions ─────────────────────────────────────────────────────────────

export type FfmpegTransitionKind = 'xfade' | 'cut';

export interface FfmpegTransitionEntry {
  fromSceneId: string;
  toSceneId: string;
  kind: FfmpegTransitionKind;
  xfadeTransition: string | null;
  durationSeconds: number;
  offsetSeconds: number;
  inputALabel: string;
  inputBLabel: string;
  outputLabel: string;
}

// ─── Command Plan ─────────────────────────────────────────────────────────────

export interface FfmpegOutputFlags {
  videoCodec: string;
  bitrateKbps: number;
  audioCodec: string;
  audioBitrateKbps: number;
  fps: number;
  width: number;
  height: number;
  pixelFormat: string;
  movFlags: string;
  preset: string;
  crf: number;
}

export interface FfmpegCommandPlan {
  jobId: string;
  draftId: string;
  renderProjectId: string;
  fingerprintHash: string;
  sceneCommands: FfmpegSceneCommand[];
  overlayGraph: FfmpegOverlayGraph;
  audioMixPlan: FfmpegAudioMixPlan;
  subtitlePlan: FfmpegSubtitlePlan;
  transitions: FfmpegTransitionEntry[];
  allInputFiles: string[];
  filterComplexLines: string[];
  finalVideoLabel: string;
  finalAudioLabel: string;
  outputFlags: FfmpegOutputFlags;
  estimatedDurationSeconds: number;
  createdAt: string;
}

// ─── Progress Parsing ─────────────────────────────────────────────────────────

export interface FfmpegProgressFrame {
  frame: number;
  fps: number;
  timeSeconds: number;
  bitrateKbps: number;
  speed: number;
  progressPercent: number;
  rawLine: string;
}

// ─── Finalization ─────────────────────────────────────────────────────────────

export interface FfmpegFinalizedArtifact {
  artifactType: string;
  localPath: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

export interface FfmpegFinalizePlan {
  mainOutputPath: string;
  thumbnailCommand: string[];
  previewCommand: string[];
  subtitleFiles: Array<{ path: string; content: string; mimeType: string }>;
  storageBasePath: string;
}

// ─── Edge Function Shapes ─────────────────────────────────────────────────────

export interface FfmpegExecutorStartPayload {
  jobId: string;
  commandPlan: FfmpegCommandPlan;
  finalizePlan: FfmpegFinalizePlan;
  renderConfig: RenderConfig;
  manifest: RenderManifest;
}

export interface FfmpegExecutorProgressResponse {
  jobId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progressPercent: number;
  currentStep: string;
  lastFrame: FfmpegProgressFrame | null;
  errorMessage: string | null;
}

export interface FfmpegExecutorCancelResponse {
  jobId: string;
  cancelled: boolean;
}

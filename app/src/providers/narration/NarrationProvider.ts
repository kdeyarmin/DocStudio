import type { DocStudioAsset } from '../../types/doc-studio';
import type {
  DocumentationScene,
  DocumentationNarrationSegment,
  NarrationTimingMetadata,
  NarrationStyle,
  PronunciationDictionaryEntry,
  CaptionManifest,
  ElevenLabsAlignmentData,
  TimingIngestionResult,
  AudioReplacementRecord,
  AudioReplacementPayload,
} from '../../types/documentation';

// ─── Voice Model Configuration ────────────────────────────────────────────────

export interface ElevenLabsVoiceModelConfig {
  voice_id: string;
  model_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  language_code?: string;
  optimize_streaming_latency?: 0 | 1 | 2 | 3 | 4;
}

export type VoiceConfigOptions = Partial<ElevenLabsVoiceModelConfig>;

export const DEFAULT_VOICE_MODEL_CONFIG: ElevenLabsVoiceModelConfig = {
  voice_id: '21m00Tcm4TlvDq8ikWAM',
  model_id: 'eleven_v3',
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

// ─── Scene Position Hint ──────────────────────────────────────────────────────

export type ScenePosition = 'first' | 'middle' | 'last' | 'only';

// ─── Core Narration Payloads ──────────────────────────────────────────────────

export interface NarrationPayload {
  draftId: string;
  organizationId: string;
  voiceId?: string;
  voiceConfig?: VoiceConfigOptions;
}

export interface NarrationResult {
  asset: DocStudioAsset;
  durationSeconds: number;
  provider: string;
  voiceId: string;
  timingPlaceholder?: NarrationTimingMetadata;
}

export interface NarrationSegmentPayload {
  draftId: string;
  organizationId: string;
  segmentId: string;
  sceneId: string | null;
  narrationText: string;
  style: NarrationStyle;
  voiceId?: string;
  voiceConfig?: VoiceConfigOptions;
  targetDurationSeconds?: number | null;
  applyPronunciationDictionary?: boolean;
}

export interface NarrationSegmentResult {
  segmentId: string;
  audioAssetId: string;
  durationSeconds: number;
  timingMetadata: NarrationTimingMetadata;
  provider: string;
  voiceId: string;
  model: string;
}

export interface NarrationBatchResult {
  results: NarrationSegmentResult[];
  failedSegmentIds: string[];
  totalDurationSeconds: number;
  provider: string;
}

// ─── Per-Scene Narration ──────────────────────────────────────────────────────

export interface SceneNarrationPayload extends NarrationSegmentPayload {
  scene: DocumentationScene;
  scenePosition: ScenePosition;
  sceneIndex: number;
  totalSceneCount: number;
  stepCount?: number;
  screenshotRole?: string;
}

export interface AllScenesNarrationResult {
  bySceneId: Map<string, NarrationSegmentResult>;
  orderedResults: NarrationSegmentResult[];
  failedSceneIds: string[];
  totalDurationSeconds: number;
  captionManifest?: CaptionManifest;
  provider: string;
}

// ─── Pronunciation Application ────────────────────────────────────────────────

export interface PronunciationApplicationResult {
  processedText: string;
  appliedEntries: Array<{ term: string; mode: string; replacement: string }>;
  appliedCount: number;
}

// ─── Timing Metadata Placeholder ─────────────────────────────────────────────

export interface TimingPlaceholderOptions {
  estimatedDurationSeconds: number;
  wordCount?: number;
  wpm?: number;
  offsetMs?: number;
  style?: NarrationStyle;
}

// ─── Caption Sync ─────────────────────────────────────────────────────────────

export type CaptionExportFormat = 'srt' | 'vtt' | 'raw' | 'json';

export interface CaptionSyncPayload {
  segmentId: string;
  draftId: string;
  timing: NarrationTimingMetadata;
  offsetAdjustmentMs?: number;
  exportFormat?: CaptionExportFormat;
}

export interface CaptionSyncResult {
  segmentId: string;
  captionBlocks: Array<{
    index: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
  exportedContent?: string;
  format: CaptionExportFormat;
  totalDurationMs: number;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface NarrationProvider {
  readonly name: string;

  generateNarration(payload: NarrationPayload): Promise<NarrationResult>;

  generateSegmentNarration?(
    payload: NarrationSegmentPayload,
  ): Promise<NarrationSegmentResult>;

  generateBatchNarration?(
    payloads: NarrationSegmentPayload[],
  ): Promise<NarrationBatchResult>;

  generateSceneNarration?(
    payload: SceneNarrationPayload,
  ): Promise<NarrationSegmentResult>;

  generateAllScenesNarration?(
    scenes: DocumentationScene[],
    segments: DocumentationNarrationSegment[],
    organizationId: string,
    draftId: string,
    voiceConfig?: VoiceConfigOptions,
    dictionary?: PronunciationDictionaryEntry[],
  ): Promise<AllScenesNarrationResult>;

  syncCaptionsForSegment?(
    payload: CaptionSyncPayload,
  ): Promise<CaptionSyncResult>;

  ingestTimingData?(
    segmentId: string,
    draftId: string,
    rawAlignment: ElevenLabsAlignmentData,
    offsetMs?: number,
  ): Promise<TimingIngestionResult>;

  replaceSceneAudio?(
    payload: AudioReplacementPayload,
  ): Promise<AudioReplacementRecord>;
}

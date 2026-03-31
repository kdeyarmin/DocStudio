import { supabase } from '../../lib/supabase';
import type {
  NarrationProvider,
  NarrationPayload,
  NarrationResult,
  NarrationSegmentPayload,
  NarrationSegmentResult,
  NarrationBatchResult,
  SceneNarrationPayload,
  AllScenesNarrationResult,
  CaptionSyncPayload,
  CaptionSyncResult,
  ElevenLabsVoiceModelConfig,
  VoiceConfigOptions,
  TimingPlaceholderOptions,
  PronunciationApplicationResult,
  CaptionExportFormat,
} from './NarrationProvider';
import { DEFAULT_VOICE_MODEL_CONFIG } from './NarrationProvider';
import type {
  DocumentationScene,
  DocumentationNarrationSegment,
  NarrationTimingMetadata,
  PronunciationDictionaryEntry,
  CaptionManifest,
  AssemblyConfig,
  ElevenLabsAlignmentData,
  TimingIngestionResult,
  AudioReplacementRecord,
  AudioReplacementPayload,
} from '../../types/documentation';
import { applyPronunciationDictionary, assembleNarrationPackage } from './NarrationSegmentService';

const NARRATION_FN = 'doc-studio-narration';
const NARRATION_SEGMENTS_FN = 'doc-studio-narration-segments';
const ASSEMBLY_FN = 'doc-studio-assembly';
const PACKAGE_FN = 'doc-studio-package';

export interface AudioAssemblyTriggerResult {
  draftId: string;
  assemblyId: string;
  status: string;
  sceneCount: number;
  assembledSceneCount: number;
  totalDurationSeconds: number;
}

export interface FullAssemblyTriggerResult {
  draftId: string;
  audioAssemblyId: string | null;
  captionManifestId: string | null;
  packageExportId: string | null;
  packageVersion: number;
  totalDurationSeconds: number;
  audioCoveragePct: number;
  captionCoveragePct: number;
}

// ─── Caption Not Implemented Error ───────────────────────────────────────────

class CaptionSyncNotImplementedError extends Error {
  constructor(featureHint: string) {
    super(
      `Caption sync is not yet implemented (${featureHint}). ` +
        'This stub is ready for wiring to ElevenLabs Timestamps API or an ' +
        'external caption alignment service. Implement syncCaptionsForSegment() ' +
        'in FutureElevenLabsNarrationProvider when the Timestamps API is available.',
    );
    this.name = 'CaptionSyncNotImplementedError';
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class FutureElevenLabsNarrationProvider implements NarrationProvider {
  readonly name = 'elevenlabs';

  private readonly voiceConfig: ElevenLabsVoiceModelConfig;

  constructor(voiceConfig?: VoiceConfigOptions) {
    this.voiceConfig = { ...DEFAULT_VOICE_MODEL_CONFIG, ...voiceConfig };
  }

  // ── Returns a new instance with the given config merged on top ───────────

  withVoiceConfig(overrides: VoiceConfigOptions): FutureElevenLabsNarrationProvider {
    return new FutureElevenLabsNarrationProvider({ ...this.voiceConfig, ...overrides });
  }

  // ── Merge caller's voice config overrides with instance defaults ─────────

  private resolveVoiceConfig(overrides?: VoiceConfigOptions): ElevenLabsVoiceModelConfig {
    return { ...this.voiceConfig, ...overrides };
  }

  // ─── Full-Draft Narration ────────────────────────────────────────────────

  async generateNarration(payload: NarrationPayload): Promise<NarrationResult> {
    const cfg = this.resolveVoiceConfig(payload.voiceConfig);

    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      asset: NarrationResult['asset'];
      duration_seconds: number;
      voice_id: string;
      timing_placeholder?: NarrationTimingMetadata;
      error?: string;
    }>(NARRATION_FN, {
      body: {
        action: 'generate',
        draftId: payload.draftId,
        organizationId: payload.organizationId,
        voiceId: payload.voiceId ?? cfg.voice_id,
        voice_model_config: {
          model_id: cfg.model_id,
          stability: cfg.stability,
          similarity_boost: cfg.similarity_boost,
          style: cfg.style,
          use_speaker_boost: cfg.use_speaker_boost,
          language_code: cfg.language_code,
          optimize_streaming_latency: cfg.optimize_streaming_latency,
        },
      },
    });

    if (error) throw new Error(error.message ?? 'Narration request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Narration generation failed');

    return {
      asset: data.asset,
      durationSeconds: data.duration_seconds ?? 0,
      provider: 'elevenlabs',
      voiceId: data.voice_id,
      timingPlaceholder: data.timing_placeholder,
    };
  }

  // ─── Single-Segment Narration ────────────────────────────────────────────

  async generateSegmentNarration(payload: NarrationSegmentPayload): Promise<NarrationSegmentResult> {
    const cfg = this.resolveVoiceConfig(payload.voiceConfig);

    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      segment_id: string;
      audio_asset_id: string;
      duration_seconds: number;
      timing_metadata: NarrationTimingMetadata;
      voice_id: string;
      model: string;
      provider: string;
      error?: string;
    }>(NARRATION_SEGMENTS_FN, {
      body: {
        action: 'generate_segment',
        draft_id: payload.draftId,
        organization_id: payload.organizationId,
        segment_id: payload.segmentId,
        scene_id: payload.sceneId,
        narration_text: payload.narrationText,
        style: payload.style,
        voice_id: payload.voiceId ?? cfg.voice_id,
        voice_model_config: {
          model_id: cfg.model_id,
          stability: cfg.stability,
          similarity_boost: cfg.similarity_boost,
          style: cfg.style,
          use_speaker_boost: cfg.use_speaker_boost,
          language_code: cfg.language_code,
        },
        target_duration_seconds: payload.targetDurationSeconds,
        apply_pronunciation_dictionary: payload.applyPronunciationDictionary ?? true,
      },
    });

    if (error) throw new Error(error.message ?? 'Segment narration request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Segment narration generation failed');

    return {
      segmentId: data.segment_id,
      audioAssetId: data.audio_asset_id,
      durationSeconds: data.duration_seconds ?? 0,
      timingMetadata: data.timing_metadata ?? {},
      provider: data.provider ?? 'elevenlabs',
      voiceId: data.voice_id ?? payload.voiceId ?? cfg.voice_id,
      model: data.model ?? cfg.model_id,
    };
  }

  // ─── Batch Narration ─────────────────────────────────────────────────────

  async generateBatchNarration(payloads: NarrationSegmentPayload[]): Promise<NarrationBatchResult> {
    if (!payloads.length) {
      return {
        results: [],
        failedSegmentIds: [],
        totalDurationSeconds: 0,
        provider: 'elevenlabs',
      };
    }
    const organizationId = payloads[0]?.organizationId;
    const draftId = payloads[0]?.draftId;
    if (!organizationId || !draftId) {
      throw new Error('organizationId and draftId are required for batch narration');
    }
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      results: Array<{
        segment_id: string;
        audio_asset_id: string;
        duration_seconds: number;
        timing_metadata: NarrationTimingMetadata;
        voice_id: string;
        model: string;
        provider: string;
      }>;
      failed_segment_ids: string[];
      total_duration_seconds: number;
      provider: string;
      error?: string;
    }>(NARRATION_SEGMENTS_FN, {
      body: {
        action: 'generate_batch',
        draft_id: draftId,
        organization_id: organizationId,
        segments: payloads.map(p => {
          const cfg = this.resolveVoiceConfig(p.voiceConfig);
          return {
            draft_id: p.draftId,
            organization_id: p.organizationId,
            segment_id: p.segmentId,
            scene_id: p.sceneId,
            narration_text: p.narrationText,
            style: p.style,
            voice_id: p.voiceId ?? cfg.voice_id,
            voice_model_config: {
              model_id: cfg.model_id,
              stability: cfg.stability,
              similarity_boost: cfg.similarity_boost,
              style: cfg.style,
              use_speaker_boost: cfg.use_speaker_boost,
              language_code: cfg.language_code,
            },
            target_duration_seconds: p.targetDurationSeconds,
            apply_pronunciation_dictionary: p.applyPronunciationDictionary ?? true,
          };
        }),
      },
    });

    if (error) throw new Error(error.message ?? 'Batch narration request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Batch narration generation failed');

    return {
      results: (data.results ?? []).map(r => ({
        segmentId: r.segment_id,
        audioAssetId: r.audio_asset_id,
        durationSeconds: r.duration_seconds ?? 0,
        timingMetadata: r.timing_metadata ?? {},
        provider: r.provider ?? 'elevenlabs',
        voiceId: r.voice_id ?? '',
        model: r.model ?? this.voiceConfig.model_id,
      })),
      failedSegmentIds: data.failed_segment_ids ?? [],
      totalDurationSeconds: data.total_duration_seconds ?? 0,
      provider: data.provider ?? 'elevenlabs',
    };
  }

  // ─── Per-Scene Narration ─────────────────────────────────────────────────

  async generateSceneNarration(payload: SceneNarrationPayload): Promise<NarrationSegmentResult> {
    const cfg = this.resolveVoiceConfig(payload.voiceConfig);

    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      segment_id: string;
      audio_asset_id: string;
      duration_seconds: number;
      timing_metadata: NarrationTimingMetadata;
      voice_id: string;
      model: string;
      provider: string;
      error?: string;
    }>(NARRATION_SEGMENTS_FN, {
      body: {
        action: 'generate_segment',
        draft_id: payload.draftId,
        organization_id: payload.organizationId,
        segment_id: payload.segmentId,
        scene_id: payload.scene.id,
        scene_title: payload.scene.title,
        scene_position: payload.scenePosition,
        scene_index: payload.sceneIndex,
        total_scene_count: payload.totalSceneCount,
        step_count: payload.stepCount,
        screenshot_role: payload.screenshotRole,
        narration_text: payload.narrationText,
        style: payload.style,
        voice_id: payload.voiceId ?? cfg.voice_id,
        voice_model_config: {
          model_id: cfg.model_id,
          stability: cfg.stability,
          similarity_boost: cfg.similarity_boost,
          style: cfg.style,
          use_speaker_boost: cfg.use_speaker_boost,
          language_code: cfg.language_code,
        },
        target_duration_seconds: payload.targetDurationSeconds,
        apply_pronunciation_dictionary: payload.applyPronunciationDictionary ?? true,
      },
    });

    if (error) throw new Error(error.message ?? 'Scene narration request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Scene narration generation failed');

    return {
      segmentId: data.segment_id,
      audioAssetId: data.audio_asset_id,
      durationSeconds: data.duration_seconds ?? 0,
      timingMetadata: data.timing_metadata ?? {},
      provider: data.provider ?? 'elevenlabs',
      voiceId: data.voice_id ?? payload.voiceId ?? cfg.voice_id,
      model: data.model ?? cfg.model_id,
    };
  }

  // ─── All-Scenes Narration (Ordered Batch) ────────────────────────────────

  async generateAllScenesNarration(
    scenes: DocumentationScene[],
    segments: DocumentationNarrationSegment[],
    organizationId: string,
    draftId: string,
    voiceConfig?: VoiceConfigOptions,
    dictionary?: PronunciationDictionaryEntry[],
  ): Promise<AllScenesNarrationResult> {
    const cfg = this.resolveVoiceConfig(voiceConfig);
    const sceneCount = scenes.length;

    const segmentBySceneId = new Map(
      segments.filter(s => s.scene_id).map(s => [s.scene_id!, s]),
    );

    const payloads: SceneNarrationPayload[] = scenes.flatMap((scene, index) => {
      const seg = segmentBySceneId.get(scene.id);
      if (!seg) return [];

      let narrationText = seg.narration_text;
      if (dictionary && dictionary.length > 0) {
        narrationText = applyPronunciationDictionary(narrationText, dictionary);
      }

      const position =
        sceneCount === 1 ? 'only'
        : index === 0 ? 'first'
        : index === sceneCount - 1 ? 'last'
        : 'middle';

      return [{
        draftId,
        organizationId,
        segmentId: seg.id,
        sceneId: scene.id,
        narrationText,
        style: seg.style,
        voiceId: cfg.voice_id,
        voiceConfig: cfg,
        targetDurationSeconds: seg.target_duration_seconds,
        applyPronunciationDictionary: false,
        scene,
        scenePosition: position,
        sceneIndex: index,
        totalSceneCount: sceneCount,
      } satisfies SceneNarrationPayload];
    });

    const batchResult = await this.generateBatchNarration(payloads);

    const bySceneId = new Map<string, NarrationSegmentResult>();
    for (const result of batchResult.results) {
      const payload = payloads.find(p => p.segmentId === result.segmentId);
      if (payload?.sceneId) {
        bySceneId.set(payload.sceneId, result);
      }
    }

    const failedSceneIds = payloads
      .filter(p => batchResult.failedSegmentIds.includes(p.segmentId))
      .map(p => p.sceneId ?? p.segmentId);

    const orderedResults = scenes
      .map(s => bySceneId.get(s.id))
      .filter((r): r is NarrationSegmentResult => r !== undefined);

    const captionManifest = this.buildCaptionManifestFromSegments(
      scenes,
      segments,
      draftId,
      '',
    );

    return {
      bySceneId,
      orderedResults,
      failedSceneIds,
      totalDurationSeconds: batchResult.totalDurationSeconds,
      captionManifest,
      provider: 'elevenlabs',
    };
  }

  // ─── Pronunciation Application Hook ─────────────────────────────────────

  applyPronunciationHooks(
    text: string,
    dictionary: PronunciationDictionaryEntry[],
  ): PronunciationApplicationResult {
    const enabled = dictionary.filter(e => e.is_enabled);
    const appliedEntries: PronunciationApplicationResult['appliedEntries'] = [];

    let processedText = text;
    for (const entry of enabled) {
      if (entry.replacement_mode === 'none') continue;

      const target = entry.substitute_text ?? entry.phonetic_spelling;
      if (!target) continue;

      const termRegex = new RegExp(
        `\\b${entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'gi',
      );

      if (termRegex.test(processedText)) {
        appliedEntries.push({
          term: entry.term,
          mode: entry.replacement_mode,
          replacement: target,
        });
      }
    }

    processedText = applyPronunciationDictionary(processedText, dictionary);

    return {
      processedText,
      appliedEntries,
      appliedCount: appliedEntries.length,
    };
  }

  // ─── Timing Metadata Placeholder Builder ────────────────────────────────

  buildTimingPlaceholder(options: TimingPlaceholderOptions): NarrationTimingMetadata {
    const {
      estimatedDurationSeconds,
      wordCount,
      wpm = 140,
      offsetMs = 0,
    } = options;

    const totalMs = Math.round(estimatedDurationSeconds * 1000);
    const estimatedWordCount = wordCount ?? Math.round((estimatedDurationSeconds / 60) * wpm);
    const msPerWord = estimatedWordCount > 0 ? totalMs / estimatedWordCount : 0;

    const words = Array.from({ length: estimatedWordCount }, (_, i) => ({
      word: `[word_${i + 1}]`,
      start_ms: offsetMs + Math.round(i * msPerWord),
      end_ms: offsetMs + Math.round((i + 1) * msPerWord),
    }));

    return {
      total_duration_ms: totalMs,
      words,
      characters: [],
      alignment_confidence: 0,
      generated_by: 'placeholder',
    };
  }

  // ─── Caption Manifest Assembly ───────────────────────────────────────────

  buildCaptionManifestFromSegments(
    scenes: DocumentationScene[],
    segments: DocumentationNarrationSegment[],
    draftId: string,
    draftTitle: string,
  ): CaptionManifest {
    return assembleNarrationPackage(scenes, segments, draftId, draftTitle).caption_manifest;
  }

  // ─── Caption Sync (from real word-level timing) ──────────────────────────

  async syncCaptionsForSegment(payload: CaptionSyncPayload): Promise<CaptionSyncResult> {
    const format: CaptionExportFormat = payload.exportFormat ?? 'raw';
    const offsetMs = payload.offsetAdjustmentMs ?? 0;

    if (!payload.timing.words || payload.timing.words.length === 0) {
      throw new CaptionSyncNotImplementedError(
        'no word-level timing data available; generate real timing via ElevenLabs Timestamps API first',
      );
    }

    const words = payload.timing.words;
    const CHUNK_SIZE = 7;
    const captionBlocks: CaptionSyncResult['captionBlocks'] = [];

    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunk = words.slice(i, i + CHUNK_SIZE);
      captionBlocks.push({
        index: captionBlocks.length + 1,
        startMs: (chunk[0]?.start_ms ?? 0) + offsetMs,
        endMs: (chunk[chunk.length - 1]?.end_ms ?? 0) + offsetMs,
        text: chunk.map(w => w.word).join(' '),
      });
    }

    const totalDurationMs = captionBlocks.length > 0
      ? captionBlocks[captionBlocks.length - 1].endMs
      : 0;

    let exportedContent: string | undefined;
    if (format === 'srt') {
      exportedContent = captionBlocks
        .map(b =>
          `${b.index}\n${formatSrtTime(b.startMs)} --> ${formatSrtTime(b.endMs)}\n${b.text}`,
        )
        .join('\n\n');
    } else if (format === 'vtt') {
      const body = captionBlocks
        .map(b => `${formatVttTime(b.startMs)} --> ${formatVttTime(b.endMs)}\n${b.text}`)
        .join('\n\n');
      exportedContent = `WEBVTT\n\n${body}`;
    } else if (format === 'json') {
      exportedContent = JSON.stringify(captionBlocks, null, 2);
    }

    return {
      segmentId: payload.segmentId,
      captionBlocks,
      exportedContent,
      format,
      totalDurationMs,
    };
  }

  // ─── Timing Data Ingestion ───────────────────────────────────────────────

  async ingestTimingData(
    segmentId: string,
    draftId: string,
    rawAlignment: ElevenLabsAlignmentData,
    offsetMs = 0,
  ): Promise<TimingIngestionResult> {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      result: {
        segment_id: string;
        timing_metadata: NarrationTimingMetadata;
        duration_seconds: number;
        word_count: number;
        persisted: boolean;
      };
      error?: string;
    }>(ASSEMBLY_FN, {
      body: {
        action: 'ingest_timing',
        draft_id: draftId,
        organization_id: '',
        segment_id: segmentId,
        alignment: rawAlignment,
        offset_ms: offsetMs,
      },
    });

    if (error) throw new Error(error.message ?? 'Timing ingestion request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Timing ingestion failed');

    const r = data.result;
    return {
      segmentId: r.segment_id,
      timingMetadata: r.timing_metadata,
      durationSeconds: r.duration_seconds,
      wordCount: r.word_count,
      persisted: r.persisted,
    };
  }

  // ─── Audio Replacement ───────────────────────────────────────────────────

  async replaceSceneAudio(payload: AudioReplacementPayload): Promise<AudioReplacementRecord> {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      replacement: AudioReplacementRecord;
      error?: string;
    }>(ASSEMBLY_FN, {
      body: {
        action: 'replace_audio',
        draft_id: payload.draftId,
        organization_id: payload.organizationId,
        scene_id: payload.sceneId,
        segment_id: payload.segmentId,
        new_audio_asset_id: payload.newAudioAssetId,
        new_duration_seconds: payload.newDurationSeconds ?? null,
        new_timing_metadata: payload.newTimingMetadata ?? null,
        reason: payload.reason ?? null,
      },
    });

    if (error) throw new Error(error.message ?? 'Audio replacement request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Audio replacement failed');

    return data.replacement;
  }

  // ─── Export Current Voice Config ─────────────────────────────────────────

  getVoiceConfig(): Readonly<ElevenLabsVoiceModelConfig> {
    return this.voiceConfig;
  }

  // ─── Post-Narration Assembly Hooks ───────────────────────────────────────

  async triggerAudioAssembly(
    draftId: string,
    organizationId: string,
    config?: Partial<AssemblyConfig>,
  ): Promise<AudioAssemblyTriggerResult> {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      assembly_id: string;
      status: string;
      scene_count: number;
      assembled_scene_count: number;
      total_duration_seconds: number;
      error?: string;
    }>(ASSEMBLY_FN, {
      body: {
        action: 'assemble_audio',
        draft_id: draftId,
        organization_id: organizationId,
        ...(config ? { assembly_config: config } : {}),
      },
    });

    if (error) throw new Error(error.message ?? 'Audio assembly request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Audio assembly failed');

    return {
      draftId,
      assemblyId: data.assembly_id,
      status: data.status,
      sceneCount: data.scene_count ?? 0,
      assembledSceneCount: data.assembled_scene_count ?? 0,
      totalDurationSeconds: data.total_duration_seconds ?? 0,
    };
  }

  async triggerFullAssembly(
    draftId: string,
    organizationId: string,
  ): Promise<FullAssemblyTriggerResult> {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      audio_assembly_id: string | null;
      caption_manifest_id: string | null;
      package_export_id: string | null;
      package_version: number;
      total_duration_seconds: number;
      audio_coverage_pct: number;
      caption_coverage_pct: number;
      error?: string;
    }>(PACKAGE_FN, {
      body: {
        action: 'run_full_assembly',
        draft_id: draftId,
        organization_id: organizationId,
      },
    });

    if (error) throw new Error(error.message ?? 'Full assembly request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Full assembly failed');

    return {
      draftId,
      audioAssemblyId: data.audio_assembly_id ?? null,
      captionManifestId: data.caption_manifest_id ?? null,
      packageExportId: data.package_export_id ?? null,
      packageVersion: data.package_version ?? 0,
      totalDurationSeconds: data.total_duration_seconds ?? 0,
      audioCoveragePct: data.audio_coverage_pct ?? 0,
      captionCoveragePct: data.caption_coverage_pct ?? 0,
    };
  }

  // ─── Caption Not Implemented Guard ──────────────────────────────────────
  // Removed: _assertCaptionTiming — was unused. Re-add when caption sync is implemented.

  async generateAllScenesAndAssemble(
    scenes: DocumentationScene[],
    segments: DocumentationNarrationSegment[],
    organizationId: string,
    draftId: string,
    voiceConfig?: VoiceConfigOptions,
    dictionary?: PronunciationDictionaryEntry[],
    autoAssemble = true,
  ): Promise<AllScenesNarrationResult & { assemblyResult?: FullAssemblyTriggerResult }> {
    const narrationResult = await this.generateAllScenesNarration(
      scenes,
      segments,
      organizationId,
      draftId,
      voiceConfig,
      dictionary,
    );

    if (!autoAssemble || narrationResult.failedSceneIds.length === scenes.length) {
      return narrationResult;
    }

    const assemblyResult = await this.triggerFullAssembly(draftId, organizationId);

    return { ...narrationResult, assemblyResult };
  }
}

// ─── Caption Time Formatters ──────────────────────────────────────────────────

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

function formatSrtTime(ms: number): string {
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(millis).padStart(3, '0')}`;
}

function formatVttTime(ms: number): string {
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${String(millis).padStart(3, '0')}`;
}

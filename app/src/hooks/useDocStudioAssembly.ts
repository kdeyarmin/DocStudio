import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, callEdgeFunction } from '../lib/supabase';
import { logger } from '../lib/logger';
import type {
  AudioAssemblyRecord,
  CaptionManifestRecord,
  SceneAudioMapRecord,
  AssemblyHealthSummary,
  AudioReplacementRecord,
  NarrationTimingMetadata,
  ElevenLabsAlignmentData,
} from '../types/documentation';

const ASSEMBLY_FN = 'doc-studio-assembly';
const SEGMENTS_FN = 'doc-studio-narration-segments';

export interface AssemblyState {
  audioAssembly: AudioAssemblyRecord | null;
  captionManifest: CaptionManifestRecord | null;
  sceneAudioMap: SceneAudioMapRecord[];
}

export function useAssemblyState(draftId: string | null, organizationId?: string) {
  return useQuery({
    queryKey: ['doc-studio-assembly', draftId],
    queryFn: async (): Promise<AssemblyState> => {
      const res = await callEdgeFunction<{
        success: boolean;
        audio_assembly: AudioAssemblyRecord | null;
        caption_manifest: CaptionManifestRecord | null;
        scene_audio_map: SceneAudioMapRecord[];
        error?: string;
      }>(ASSEMBLY_FN, { action: 'get_assembly', draft_id: draftId, organization_id: organizationId ?? '' });
      if (!res.success) throw new Error(res.error ?? 'Failed to load assembly state');
      return {
        audioAssembly: res.audio_assembly,
        captionManifest: res.caption_manifest,
        sceneAudioMap: res.scene_audio_map ?? [],
      };
    },
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useAssemblyHealth(draftId: string | null, organizationId?: string) {
  return useQuery({
    queryKey: ['doc-studio-assembly-health', draftId],
    queryFn: async (): Promise<AssemblyHealthSummary> => {
      const res = await callEdgeFunction<{
        success: boolean;
        health: AssemblyHealthSummary;
        error?: string;
      }>(ASSEMBLY_FN, { action: 'health_check', draft_id: draftId, organization_id: organizationId ?? '' });
      if (!res.success) throw new Error(res.error ?? 'Failed to load assembly health');
      return res.health;
    },
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function useAssembleAudio(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string; config?: Record<string, unknown> }) => {
      const res = await callEdgeFunction<{
        success: boolean;
        assembly: AudioAssemblyRecord;
        error?: string;
      }>(ASSEMBLY_FN, {
        action: 'assemble_audio',
        draft_id: draftId,
        organization_id: params.organizationId,
        config: params.config,
      });
      if (!res.success) throw new Error(res.error ?? 'Audio assembly failed');
      return res.assembly;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly-health', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-quality', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAssembly] useAssembleAudio failed:', error.message);
    },
  });
}

export function useAssembleCaptions(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string }) => {
      const res = await callEdgeFunction<{
        success: boolean;
        caption_manifest: CaptionManifestRecord;
        error?: string;
      }>(ASSEMBLY_FN, {
        action: 'assemble_captions',
        draft_id: draftId,
        organization_id: params.organizationId,
      });
      if (!res.success) throw new Error(res.error ?? 'Caption assembly failed');
      return res.caption_manifest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAssembly] useAssembleCaptions failed:', error.message);
    },
  });
}

export function useGenerateSceneNarration(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      segmentId: string;
      sceneId: string;
      narrationText: string;
      voiceId?: string;
      voiceModelConfig?: Record<string, unknown>;
      targetDurationSeconds?: number | null;
    }) => {
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
        error_code?: string;
      }>(SEGMENTS_FN, {
        body: {
          action: 'generate_segment',
          draft_id: draftId,
          organization_id: params.organizationId,
          segment_id: params.segmentId,
          scene_id: params.sceneId,
          narration_text: params.narrationText,
          voice_id: params.voiceId,
          voice_model_config: params.voiceModelConfig,
          target_duration_seconds: params.targetDurationSeconds ?? null,
          apply_pronunciation_dictionary: true,
        },
      });
      if (error) throw new Error(error.message ?? 'Scene narration failed');
      if (!data?.success) {
        const err = new Error(data?.error ?? 'Scene narration generation failed') as Error & { code?: string };
        if (data?.error_code) err.code = data.error_code;
        throw err;
      }
      return {
        segmentId: data.segment_id,
        audioAssetId: data.audio_asset_id,
        durationSeconds: data.duration_seconds ?? 0,
        timingMetadata: data.timing_metadata ?? {},
        provider: data.provider ?? 'elevenlabs',
        voiceId: data.voice_id ?? params.voiceId ?? '',
        model: data.model ?? '',
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-segments', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly-health', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAssembly] useGenerateSceneNarration failed:', error.message);
    },
  });
}

export function useAssembleTimingManifest(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      segmentId: string;
      alignment: ElevenLabsAlignmentData;
      offsetMs?: number;
    }) => {
      const res = await callEdgeFunction<{
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
        action: 'ingest_timing',
        draft_id: draftId,
        organization_id: params.organizationId,
        segment_id: params.segmentId,
        alignment: params.alignment,
        offset_ms: params.offsetMs ?? 0,
      });
      if (!res.success) throw new Error(res.error ?? 'Timing ingestion failed');
      return res.result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-segments', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAssembly] useAssembleTimingManifest failed:', error.message);
    },
  });
}

export function useReplaceSceneAudio(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      sceneId: string;
      segmentId: string;
      newAudioAssetId: string;
      newDurationSeconds?: number | null;
      newTimingMetadata?: NarrationTimingMetadata | null;
      alignment?: ElevenLabsAlignmentData | null;
      reason?: string;
    }) => {
      const res = await callEdgeFunction<{
        success: boolean;
        replacement: AudioReplacementRecord;
        error?: string;
      }>(ASSEMBLY_FN, {
        action: 'replace_audio',
        draft_id: draftId,
        organization_id: params.organizationId,
        scene_id: params.sceneId,
        segment_id: params.segmentId,
        new_audio_asset_id: params.newAudioAssetId,
        new_duration_seconds: params.newDurationSeconds ?? null,
        new_timing_metadata: params.newTimingMetadata ?? null,
        alignment: params.alignment ?? null,
        reason: params.reason ?? null,
      });
      if (!res.success) throw new Error(res.error ?? 'Audio replacement failed');
      return res.replacement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly-health', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-segments', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAssembly] useReplaceSceneAudio failed:', error.message);
    },
  });
}

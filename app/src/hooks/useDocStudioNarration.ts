import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type {
  DocumentationNarrationSegment,
  NarrationStyle,
  NarrationSegmentStatus,
} from '../types/documentation';

const FN = 'doc-studio-narration-segments';

async function getOrganizationId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error('Not authenticated');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  const orgId = profile?.organization_id as string | null | undefined;
  if (!orgId) throw new Error('Organization not found');
  return orgId;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const organization_id = await getOrganizationId();
  const { data, error } = await supabase.functions.invoke<T>(FN, { body: { ...body, organization_id } });
  if (error) throw new Error(error.message);
  return data as T;
}

export function useNarrationSegments(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-narration-segments', draftId],
    queryFn: () =>
      call<{ segments: DocumentationNarrationSegment[] }>({
        action: 'list',
        draft_id: draftId,
      }).then((r) => r.segments),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useNarrationSegment(segmentId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-narration-segment', segmentId],
    queryFn: () =>
      call<{ segment: DocumentationNarrationSegment }>({
        action: 'get',
        segment_id: segmentId,
      }).then((r) => r.segment),
    enabled: !!segmentId,
    staleTime: 30 * 1000,
  });
}

export function useCreateNarrationSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      scene_id?: string | null;
      segment_order?: number;
      narration_text: string;
      short_narration_text?: string | null;
      style?: NarrationStyle;
      target_duration_seconds?: number | null;
      caption_text?: string | null;
      status?: NarrationSegmentStatus;
    }) =>
      call<{ segment: DocumentationNarrationSegment }>({ action: 'create', ...params }).then(
        (r) => r.segment
      ),
    onSuccess: (seg) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', seg.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useCreateNarrationSegment failed:', error.message);
    },
  });
}

export function useUpdateNarrationSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      segment_id: string;
      draft_id: string;
      narration_text?: string;
      short_narration_text?: string | null;
      style?: NarrationStyle;
      target_duration_seconds?: number | null;
      transcript_text?: string | null;
      caption_text?: string | null;
      timing_json?: Record<string, unknown>;
      audio_asset_id?: string | null;
      status?: NarrationSegmentStatus;
      segment_order?: number;
    }) =>
      call<{ segment: DocumentationNarrationSegment }>({ action: 'update', ...params }).then(
        (r) => r.segment
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segment', vars.segment_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useUpdateNarrationSegment failed:', error.message);
    },
  });
}

export function useDeleteNarrationSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ segment_id, draft_id }: { segment_id: string; draft_id: string }) =>
      call<{ deleted: boolean }>({ action: 'delete', segment_id }).then(() => draft_id),
    onSuccess: (draft_id) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useDeleteNarrationSegment failed:', error.message);
    },
  });
}

export function useDeleteAllNarrationSegments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft_id: string) =>
      call<{ deleted: boolean }>({ action: 'delete_all', draft_id }),
    onSuccess: (_, draft_id) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useDeleteAllNarrationSegments failed:', error.message);
    },
  });
}

export function useBulkCreateNarrationSegments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      segments: Array<{
        draft_id: string;
        scene_id?: string | null;
        segment_order?: number;
        narration_text: string;
        short_narration_text?: string | null;
        style?: NarrationStyle;
        caption_text?: string | null;
      }>;
    }) =>
      call<{ segments: DocumentationNarrationSegment[]; count: number }>({
        action: 'bulk_create',
        segments: params.segments,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useBulkCreateNarrationSegments failed:', error.message);
    },
  });
}

export function useGenerateSegmentNarration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      segment_id: string;
      draft_id: string;
      narration_text: string;
      voice_id?: string;
    }) =>
      call<{
        segment_id: string;
        audio_asset_id: string | null;
        duration_seconds: number;
        timing_metadata: Record<string, unknown>;
        voice_id: string;
        model: string;
        provider: string;
        status: string;
        message?: string;
      }>({ action: 'generate_segment', ...params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useGenerateSegmentNarration failed:', error.message);
    },
  });
}

export function useGenerateBatchNarration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      segments: Array<{ segment_id: string; narration_text: string; voice_id?: string }>;
    }) =>
      call<{
        results: unknown[];
        failed_segment_ids: string[];
        total_duration_seconds: number;
        provider: string;
        message?: string;
      }>({ action: 'generate_batch', draft_id: params.draft_id, segments: params.segments }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioNarration] useGenerateBatchNarration failed:', error.message);
    },
  });
}

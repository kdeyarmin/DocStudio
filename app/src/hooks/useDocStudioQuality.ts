import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  DocStudioQualityScore,
  DocStudioDriftCheck,
  DriftStatus,
} from '../types/documentation';

import { logger } from '../lib/logger';

const QUALITY_FN = 'doc-studio-quality';
const DRIFT_FN = 'doc-studio-drift';

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

async function callQuality<T>(body: Record<string, unknown>): Promise<T> {
  const organization_id = await getOrganizationId();
  const { data, error } = await supabase.functions.invoke<T>(QUALITY_FN, { body: { ...body, organization_id } });
  if (error) throw new Error(error.message);
  return data as T;
}

async function callDrift<T>(body: Record<string, unknown>): Promise<T> {
  const organization_id = await getOrganizationId();
  const { data, error } = await supabase.functions.invoke<T>(DRIFT_FN, { body: { ...body, organization_id } });
  if (error) throw new Error(error.message);
  return data as T;
}

export function useQualityScore(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-quality', draftId],
    queryFn: () =>
      callQuality<{ quality_score: DocStudioQualityScore | null }>({
        action: 'get',
        draft_id: draftId,
      }).then((r) => r.quality_score),
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function useQualityHistory(draftId: string | null, limit = 10) {
  return useQuery({
    queryKey: ['doc-studio-quality-history', draftId, limit],
    queryFn: () =>
      callQuality<{ history: DocStudioQualityScore[] }>({
        action: 'history',
        draft_id: draftId,
        limit,
      }).then((r) => r.history),
    enabled: !!draftId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalculateQuality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft_id: string) =>
      callQuality<{ quality_score: DocStudioQualityScore }>({
        action: 'calculate',
        draft_id,
      }).then((r) => r.quality_score),
    onSuccess: (score) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-quality', score.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-quality-history', score.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioQuality] useCalculateQuality failed:', error.message);
    },
  });
}

// ─── Drift ────────────────────────────────────────────────────────────────────

export function useDriftChecks(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-drift', draftId],
    queryFn: () =>
      callDrift<{ drift_checks: DocStudioDriftCheck[] }>({
        action: 'list',
        draft_id: draftId,
      }).then((r) => r.drift_checks),
    enabled: !!draftId,
    staleTime: 2 * 60 * 1000,
  });
}

export interface DriftSummary {
  overall_status: DriftStatus;
  total: number;
  outdated_count: number;
  warning_count: number;
  current_count: number;
}

export function useDriftSummary(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-drift-summary', draftId],
    queryFn: () =>
      callDrift<DriftSummary>({ action: 'get_summary', draft_id: draftId }),
    enabled: !!draftId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useRunDriftCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft_id: string) =>
      callDrift<{
        drift_checks: DocStudioDriftCheck[];
        overall_status: DriftStatus;
        checked_count: number;
      }>({ action: 'run_check', draft_id }),
    onSuccess: (_, draft_id) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drift', draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drift-summary', draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioQuality] useRunDriftCheck failed:', error.message);
    },
  });
}

export function useMarkDriftValidated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { check_id: string; draft_id: string; validated_by?: string }) =>
      callDrift<{ drift_check: DocStudioDriftCheck }>({
        action: 'mark_validated',
        check_id: params.check_id,
        validated_by: params.validated_by ?? null,
      }).then((r) => r.drift_check),
    onSuccess: (check) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drift', check.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drift-summary', check.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioQuality] useMarkDriftValidated failed:', error.message);
    },
  });
}

export function useMarkAllDriftValidated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; validated_by?: string }) =>
      callDrift<{ validated: boolean }>({
        action: 'mark_all_validated',
        draft_id: params.draft_id,
        validated_by: params.validated_by ?? null,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drift', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drift-summary', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioQuality] useMarkAllDriftValidated failed:', error.message);
    },
  });
}

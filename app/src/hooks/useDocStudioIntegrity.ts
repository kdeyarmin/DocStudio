import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  fetchLatestIntegrityReport,
  fetchIntegrityReports,
  fetchRevalidationEvents,
  markDraftRevalidationRequired,
} from '../lib/tutorialIntegrityEngine';
import type { TutorialIntegrityReport, IntegrityCategory } from '../types/documentation';

const INTEGRITY_FN = 'doc-studio-integrity';

async function callIntegrity<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(INTEGRITY_FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

// ─── Read Hooks ───────────────────────────────────────────────────────────────

export function useDocStudioIntegrityReport(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-integrity-report', draftId],
    queryFn: () => fetchLatestIntegrityReport(draftId!),
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function useDocStudioIntegrityHistory(draftId: string | null, limit = 10) {
  return useQuery({
    queryKey: ['doc-studio-integrity-history', draftId, limit],
    queryFn: () => fetchIntegrityReports(draftId!, limit),
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function useDocStudioRevalidationEvents(draftId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['doc-studio-revalidation-events', draftId, limit],
    queryFn: () => fetchRevalidationEvents(draftId!, limit),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useDocStudioIntegrityQueue(limit = 50) {
  return useQuery({
    queryKey: ['doc-studio-integrity-queue', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_studio_drafts')
        .select(
          'id, title, integrity_status, integrity_score, revalidation_required, last_captured_at, updated_at',
        )
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 1000,
  });
}

// ─── Mutation Hooks ───────────────────────────────────────────────────────────

export function useRunIntegrityCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      categories?: IntegrityCategory[];
    }) =>
      callIntegrity<{ report: TutorialIntegrityReport }>({
        action: 'run_check',
        draft_id: params.draft_id,
        categories: params.categories ?? null,
      }).then((r) => r.report),
    onSuccess: (report) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-report', report.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-history', report.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-revalidation-events', report.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-queue'] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioIntegrity] useRunIntegrityCheck failed:', error.message);
    },
  });
}

export function useMarkRevalidationRequired() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      reason: string;
    }) => markDraftRevalidationRequired(params.draft_id, params.reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-report', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-revalidation-events', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-queue'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioIntegrity] useMarkRevalidationRequired failed:', error.message);
    },
  });
}

export function useMarkDraftValidated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; notes?: string }) =>
      callIntegrity<{ success: boolean }>({
        action: 'mark_validated',
        draft_id: params.draft_id,
        notes: params.notes ?? null,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-report', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-revalidation-events', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-queue'] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioIntegrity] useMarkDraftValidated failed:', error.message);
    },
  });
}

export function useRequestRecapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; reason?: string }) =>
      callIntegrity<{ success: boolean }>({
        action: 'request_recapture',
        draft_id: params.draft_id,
        reason: params.reason ?? null,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-report', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-revalidation-events', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-queue'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioIntegrity] useRequestRecapture failed:', error.message);
    },
  });
}

export function useResolveDrift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; notes?: string }) =>
      callIntegrity<{ success: boolean }>({
        action: 'resolve_drift',
        draft_id: params.draft_id,
        notes: params.notes ?? null,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-report', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-revalidation-events', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioIntegrity] useResolveDrift failed:', error.message);
    },
  });
}

export interface RevalidationQueueReport {
  draft_id: string;
  capture_score: number | null;
  content_score: number | null;
  narration_score: number | null;
  screenshot_score: number | null;
  scene_score: number | null;
  shot_plan_score: number | null;
  caption_score: number | null;
  render_score: number | null;
  drift_score: number | null;
  warnings_json: string[] | null;
  failures_json: string[] | null;
  last_checked_at: string | null;
}

export interface RevalidationQueueDraft {
  id: string;
  title: string;
  integrity_status: string | null;
  integrity_score: number | null;
  revalidation_required: boolean | null;
  last_captured_at: string | null;
  updated_at: string;
  drift_deepened_at: string | null;
  latestReport: RevalidationQueueReport | null;
}

export function useRevalidationQueueFull(limit = 200) {
  return useQuery({
    queryKey: ['doc-studio-revalidation-queue-full', limit],
    queryFn: async () => {
      const [draftsRes, reportsRes] = await Promise.all([
        supabase
          .from('doc_studio_drafts')
          .select('id, title, integrity_status, integrity_score, revalidation_required, last_captured_at, updated_at, drift_deepened_at')
          .order('updated_at', { ascending: false })
          .limit(limit),
        supabase
          .from('doc_studio_integrity_reports')
          .select('draft_id, capture_score, content_score, narration_score, screenshot_score, scene_score, shot_plan_score, caption_score, render_score, drift_score, warnings_json, failures_json, last_checked_at')
          .order('last_checked_at', { ascending: false })
          .limit(limit * 3),
      ]);

      if (draftsRes.error) throw draftsRes.error;
      if (reportsRes.error) throw reportsRes.error;

      const reportMap = new Map<string, RevalidationQueueReport>();
      for (const r of (reportsRes.data ?? [])) {
        if (!reportMap.has(r.draft_id)) {
          reportMap.set(r.draft_id, r as RevalidationQueueReport);
        }
      }

      return (draftsRes.data ?? []).map((d) => ({
        ...d,
        latestReport: reportMap.get(d.id) ?? null,
      })) as RevalidationQueueDraft[];
    },
    staleTime: 30 * 1000,
  });
}

export function useRegenerateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string }) =>
      callIntegrity<{ success: boolean }>({
        action: 'request_content_regen',
        draft_id: params.draft_id,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-report', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-revalidation-events', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioIntegrity] useRegenerateContent failed:', error.message);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { FutureOpenAITutorialReviewProvider } from '../providers/review/FutureOpenAITutorialReviewProvider';
import type { AIReviewRun, AISuggestionAction, AISuggestionActionType, AIReviewVerdict } from '../types/doc-studio-review';
import type { ApprovalReadinessPayload, ApprovalReadinessResult } from '../providers/review/TutorialReviewProvider';

const provider = new FutureOpenAITutorialReviewProvider();

// ─── Verdict mapping ──────────────────────────────────────────────────────────

function toDBVerdict(v: ApprovalReadinessResult['verdict']): AIReviewVerdict {
  switch (v) {
    case 'approved':               return 'pass';
    case 'conditionally_approved': return 'pass_with_notes';
    case 'needs_work':             return 'needs_work';
    case 'blocked':                return 'fail';
  }
}

// ─── AI Review Runs ───────────────────────────────────────────────────────────

export function useAIReviewRuns(draftId: string | null, reviewType?: string) {
  return useQuery({
    queryKey: ['ai-review-runs', draftId, reviewType ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('doc_studio_ai_review_runs')
        .select('*')
        .eq('draft_id', draftId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (reviewType) q = q.eq('review_type', reviewType);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as AIReviewRun[];
    },
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useLatestAIReviewRun(draftId: string | null, reviewType = 'approval_readiness') {
  return useQuery({
    queryKey: ['ai-review-runs-latest', draftId, reviewType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_studio_ai_review_runs')
        .select('*')
        .eq('draft_id', draftId!)
        .eq('review_type', reviewType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as AIReviewRun | null;
    },
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

// ─── Run AI Review (approval readiness) ───────────────────────────────────────

interface RunAIReviewParams {
  payload: ApprovalReadinessPayload;
  runLabel?: string;
}

export function useRunAIReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, runLabel }: RunAIReviewParams): Promise<AIReviewRun> => {
      const result = await provider.evaluateApprovalReadiness(payload);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const row = {
        draft_id:           payload.context.draftId,
        organization_id:    payload.context.organizationId,
        review_type:        'approval_readiness',
        run_label:          runLabel ?? null,
        result_json:        result as unknown as Record<string, unknown>,
        overall_score:      result.overall_readiness_score,
        verdict:            toDBVerdict(result.verdict),
        hard_blocker_count: result.hard_blockers.length,
        soft_blocker_count: result.soft_blockers.length,
        model:              result.model,
        created_by:         userId,
      };

      const { data, error } = await supabase
        .from('doc_studio_ai_review_runs')
        .insert(row)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as AIReviewRun;
    },
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['ai-review-runs', run.draft_id] });
      qc.invalidateQueries({ queryKey: ['ai-review-runs-latest', run.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAIReview] useRunAIReview failed:', error.message);
    },
  });
}

// ─── Suggestion Actions ───────────────────────────────────────────────────────

export function useSuggestionActions(runId: string | null) {
  return useQuery({
    queryKey: ['ai-suggestion-actions', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_studio_ai_suggestion_actions')
        .select('*')
        .eq('ai_review_run_id', runId!)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as AISuggestionAction[];
    },
    enabled: !!runId,
    staleTime: 15 * 1000,
  });
}

interface RecordSuggestionActionParams {
  draftId: string;
  organizationId: string;
  runId: string;
  suggestionKey: string;
  suggestionJson: Record<string, unknown>;
  action: AISuggestionActionType;
  changeRequestId?: string;
  notes?: string;
}

export function useRecordSuggestionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: RecordSuggestionActionParams): Promise<AISuggestionAction> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const row = {
        draft_id:          params.draftId,
        organization_id:   params.organizationId,
        ai_review_run_id:  params.runId,
        suggestion_key:    params.suggestionKey,
        suggestion_json:   params.suggestionJson,
        action:            params.action,
        change_request_id: params.changeRequestId ?? null,
        notes:             params.notes ?? null,
        acted_by:          userId,
      };

      const { data, error } = await supabase
        .from('doc_studio_ai_suggestion_actions')
        .upsert(row, { onConflict: 'ai_review_run_id,suggestion_key' })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as AISuggestionAction;
    },
    onSuccess: (action) => {
      qc.invalidateQueries({ queryKey: ['ai-suggestion-actions', action.ai_review_run_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAIReview] useRecordSuggestionAction failed:', error.message);
    },
  });
}

// ─── Toggle AI Review Required ────────────────────────────────────────────────

interface SetAIReviewRequiredParams {
  draftId: string;
  organizationId: string;
  required: boolean;
}

export function useSetAIReviewRequired() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: SetAIReviewRequiredParams) => {
      const { error } = await supabase
        .from('doc_studio_review_workflows')
        .update({ ai_review_required: params.required })
        .eq('draft_id', params.draftId)
        .eq('organization_id', params.organizationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', vars.draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioAIReview] useSetAIReviewRequired failed:', error.message);
    },
  });
}

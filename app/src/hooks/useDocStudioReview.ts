import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  ReviewWorkflow, ReviewTask, ReviewComment, ChangeRequest,
  ChecklistTemplate, ChecklistResult, ReviewHistoryEntry,
  ReviewDashboardData, AssignReviewerParams, RequestChangesParams,
} from '../types/doc-studio-review';

import { logger } from '../lib/logger';

const FN = 'doc-studio-review';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export function useReviewWorkflow(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-review-workflow', draftId],
    queryFn: () =>
      call<{ workflow: ReviewWorkflow | null }>({ action: 'get_workflow', draft_id: draftId })
        .then((r) => r.workflow),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useAssignReviewer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: AssignReviewerParams) =>
      call<{ success: boolean }>({ action: 'assign_reviewer', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-tasks', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-dashboard'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useAssignReviewer failed:', error.message);
    },
  });
}

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) =>
      call<{ success: boolean }>({ action: 'start_review', draft_id: draftId }),
    onSuccess: (_data, draftId) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-dashboard'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useStartReview failed:', error.message);
    },
  });
}

export function useApproveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; organization_id?: string; approval_notes?: string }) =>
      call<{ success: boolean }>({ action: 'approve', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-dashboard'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useApproveReview failed:', error.message);
    },
  });
}

export function useRequestChanges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: RequestChangesParams) =>
      call<{ success: boolean }>({ action: 'request_changes', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-change-requests', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-dashboard'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useRequestChanges failed:', error.message);
    },
  });
}

export function useAdvanceReviewStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; organization_id?: string; stage?: string }) =>
      call<{ success: boolean }>({ action: 'advance_stage', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-dashboard'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useAdvanceReviewStage failed:', error.message);
    },
  });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function useReviewTasks(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-review-tasks', draftId],
    queryFn: () =>
      call<{ tasks: ReviewTask[] }>({ action: 'list_tasks', draft_id: draftId })
        .then((r) => r.tasks),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useUpdateReviewTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { task_id: string; draft_id: string; status?: string; updates?: Partial<ReviewTask> }) =>
      call<{ success: boolean }>({ action: 'update_task', task_id: params.task_id, status: params.status, updates: params.updates }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-tasks', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useUpdateReviewTask failed:', error.message);
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function useReviewComments(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-review-comments', draftId],
    queryFn: () =>
      call<{ comments: ReviewComment[] }>({ action: 'list_comments', draft_id: draftId })
        .then((r) => r.comments),
    enabled: !!draftId,
    staleTime: 15 * 1000,
  });
}

export function useAddReviewComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      organization_id?: string;
      comment_type?: string;
      message: string;
      scene_id?: string;
      shot_id?: string;
      parent_comment_id?: string;
    }) => call<{ comment: ReviewComment }>({ action: 'add_comment', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-comments', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useAddReviewComment failed:', error.message);
    },
  });
}

export function useResolveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { comment_id: string; draft_id: string; dismiss?: boolean }) =>
      call<{ success: boolean }>({
        action: params.dismiss ? 'dismiss_comment' : 'resolve_comment',
        comment_id: params.comment_id,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-comments', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useResolveComment failed:', error.message);
    },
  });
}

// ─── Change Requests ──────────────────────────────────────────────────────────

export function useChangeRequests(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-change-requests', draftId],
    queryFn: () =>
      call<{ change_requests: ChangeRequest[] }>({ action: 'list_change_requests', draft_id: draftId })
        .then((r) => r.change_requests),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useCreateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      organization_id?: string;
      change_type?: string;
      description?: string;
      assigned_to_id?: string;
      changes?: Array<{ change_type: string; description: string }>;
    }) => call<{ change_request: ChangeRequest }>({ action: 'create_change_request', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-change-requests', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-workflow', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useCreateChangeRequest failed:', error.message);
    },
  });
}

export function useUpdateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      change_request_id: string;
      draft_id: string;
      status: string;
      resolution_notes?: string;
    }) =>
      call<{ success: boolean }>({
        action: 'update_change_request',
        change_request_id: params.change_request_id,
        status: params.status,
        resolution_notes: params.resolution_notes,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-change-requests', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useUpdateChangeRequest failed:', error.message);
    },
  });
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export function useReviewChecklist(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-review-checklist', draftId],
    queryFn: () =>
      call<{ templates: ChecklistTemplate[]; results: ChecklistResult[] }>({
        action: 'get_checklist',
        draft_id: draftId,
      }),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useUpsertChecklistResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      organization_id?: string;
      checklist_item_id: string;
      passed: boolean;
      notes?: string;
    }) => call<{ success: boolean }>({ action: 'upsert_checklist_result', ...params }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-review-checklist', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-review-history', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useUpsertChecklistResult failed:', error.message);
    },
  });
}

// ─── History ──────────────────────────────────────────────────────────────────

export function useReviewHistory(draftId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['doc-studio-review-history', draftId, limit],
    queryFn: () =>
      call<{ history: ReviewHistoryEntry[] }>({ action: 'list_history', draft_id: draftId, limit })
        .then((r) => r.history),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useReviewDashboard(organizationId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-review-dashboard', organizationId],
    queryFn: () =>
      call<ReviewDashboardData>({ action: 'get_dashboard', organization_id: organizationId }),
    enabled: !!organizationId,
    staleTime: 30 * 1000,
  });
}

// ─── Checklist Template Management ────────────────────────────────────────────

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['doc-studio-checklist-templates'],
    queryFn: () =>
      call<{ success: boolean; data: ChecklistTemplate[] }>({ action: 'list_checklist_templates' })
        .then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useUpsertChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id?: string;
      category: ChecklistTemplate['category'];
      label: string;
      description?: string;
      sort_order?: number;
      is_required?: boolean;
      is_active?: boolean;
    }) => call<{ success: boolean; data: ChecklistTemplate }>({ action: 'upsert_checklist_template', ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-checklist-templates'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useUpsertChecklistTemplate failed:', error.message);
    },
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      call<{ success: boolean }>({ action: 'delete_checklist_template', id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-checklist-templates'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioReview] useDeleteChecklistTemplate failed:', error.message);
    },
  });
}

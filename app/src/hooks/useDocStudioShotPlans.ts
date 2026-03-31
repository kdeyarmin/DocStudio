import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  fetchShotPlansForDraft,
  fetchShotPlansForScene,
  countShotPlansForDraft,
  fetchKeyShots,
  updateShotPlan,
  deleteShotPlan,
  reorderShotPlans,
  toggleKeyShotFlag,
  buildShotPlanSummary,
} from '../lib/shotPlanService';
import type { DocumentationShotPlan } from '../types/documentation';
import type { UpdateShotPlanPayload } from '../lib/shotPlanService';

const SHOT_PLANS_FN = 'doc-studio-shot-plans';

async function callShotPlans<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(SHOT_PLANS_FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

// ─── Read Hooks ───────────────────────────────────────────────────────────────

export function useDocStudioShotPlans(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-shot-plans', draftId],
    queryFn: () => fetchShotPlansForDraft(draftId!),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useDocStudioShotPlansForScene(
  draftId: string | null,
  sceneId: string | null,
) {
  return useQuery({
    queryKey: ['doc-studio-shot-plans-scene', draftId, sceneId],
    queryFn: () => fetchShotPlansForScene(draftId!, sceneId!),
    enabled: !!draftId && !!sceneId,
    staleTime: 30 * 1000,
  });
}

export function useDocStudioShotPlanCount(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-shot-plan-count', draftId],
    queryFn: () => countShotPlansForDraft(draftId!),
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function useDocStudioKeyShots(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-key-shots', draftId],
    queryFn: () => fetchKeyShots(draftId!),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useDocStudioShotPlanSummary(draftId: string | null) {
  const { data: plans, ...rest } = useDocStudioShotPlans(draftId);
  return {
    ...rest,
    data: plans ? buildShotPlanSummary(plans) : undefined,
  };
}

// ─── Generate Mutations ───────────────────────────────────────────────────────

export function useGenerateShotPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      replace_existing?: boolean;
    }) =>
      callShotPlans<{
        success: boolean;
        created: number;
        skipped: number;
        warnings: string[];
        plans: DocumentationShotPlan[];
      }>({
        action: 'generate',
        draft_id: params.draft_id,
        replace_existing: params.replace_existing ?? false,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plan-count', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-key-shots', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useGenerateShotPlans failed:', error.message);
    },
  });
}

export function useRegenerateShotPlansForScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; scene_id: string }) =>
      callShotPlans<{
        success: boolean;
        created: number;
        plans: DocumentationShotPlan[];
        warnings: string[];
      }>({
        action: 'regenerate_scene',
        draft_id: params.draft_id,
        scene_id: params.scene_id,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans-scene', vars.draft_id, vars.scene_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-key-shots', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useRegenerateShotPlansForScene failed:', error.message);
    },
  });
}

// ─── Update / Delete Mutations ────────────────────────────────────────────────

export function useUpdateShotPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { shot_plan_id: string; draft_id: string; updates: UpdateShotPlanPayload }) =>
      updateShotPlan(params.shot_plan_id, params.updates),
    onSuccess: (plan, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', vars.draft_id] });
      if (plan.scene_id) {
        qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans-scene', vars.draft_id, plan.scene_id] });
      }
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useUpdateShotPlan failed:', error.message);
    },
  });
}

export function useDeleteShotPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { shot_plan_id: string; draft_id: string; scene_id?: string | null }) =>
      deleteShotPlan(params.shot_plan_id).then(() => params),
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plan-count', vars.draft_id] });
      if (vars.scene_id) {
        qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans-scene', vars.draft_id, vars.scene_id] });
      }
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useDeleteShotPlan failed:', error.message);
    },
  });
}

export function useDeleteAllShotPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string }) =>
      callShotPlans<{ deleted: number }>({ action: 'delete_all', draft_id: params.draft_id }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plan-count', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-key-shots', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useDeleteAllShotPlans failed:', error.message);
    },
  });
}

export function useReorderShotPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      updates: Array<{ id: string; shot_order: number }>;
      orgId: string;
    }) => reorderShotPlans(params.updates, params.orgId).then(() => params.draft_id),
    onSuccess: (draftId) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useReorderShotPlans failed:', error.message);
    },
  });
}

export function useToggleKeyShotFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      shot_plan_id: string;
      draft_id: string;
      is_key_shot: boolean;
    }) =>
      toggleKeyShotFlag(params.shot_plan_id, params.is_key_shot).then(() => params),
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-key-shots', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useToggleKeyShotFlag failed:', error.message);
    },
  });
}

export function useCreateShotPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      scene_id?: string | null;
      title: string;
      shot_type?: string;
      shot_order?: number;
    }) =>
      callShotPlans<{ plan: DocumentationShotPlan }>({
        action: 'create',
        ...params,
      }).then((r) => r.plan),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans', plan.draft_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-plan-count', plan.draft_id] });
      if (plan.scene_id) {
        qc.invalidateQueries({ queryKey: ['doc-studio-shot-plans-scene', plan.draft_id, plan.scene_id] });
      }
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioShotPlans] useCreateShotPlan failed:', error.message);
    },
  });
}

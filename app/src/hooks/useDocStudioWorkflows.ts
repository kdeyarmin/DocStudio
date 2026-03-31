import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { logger } from '../lib/logger';
import type {
  DocumentationWorkflow,
  DocumentationWorkflowStep,
  StepActionType,
  WaitStrategy,
  ErrorHandlingStrategy,
  SelectorStrategy,
} from '../types/documentation';

const FN = 'doc-studio-workflows';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export function useDocStudioWorkflows(opts?: { search?: string; isActive?: boolean; organizationId?: string }) {
  return useQuery({
    queryKey: ['doc-studio-workflows', opts],
    queryFn: () =>
      call<{ workflows: DocumentationWorkflow[] }>({
        action: 'list',
        search: opts?.search ?? '',
        is_active: opts?.isActive ?? true,
        organization_id: opts?.organizationId ?? null,
      }).then((r) => r.workflows),
    staleTime: 2 * 60 * 1000,
  });
}

export function useDocStudioWorkflow(
  workflowId: string | null,
  organizationId?: string,
) {
  return useQuery({
    queryKey: ['doc-studio-workflow', workflowId],
    queryFn: () =>
      call<{ workflow: DocumentationWorkflow }>({
        action: 'get',
        workflow_id: workflowId,
        organization_id: organizationId ?? null,
      }).then((r) => r.workflow),
    enabled: !!workflowId,
    staleTime: 60 * 1000,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (params: {
      organization_id?: string;
      name: string;
      slug: string;
      description?: string;
      start_url: string;
      tutorial_group?: string;
      target_role?: string;
      automation_mode?: string;
      estimated_duration_seconds?: number;
      default_output_type?: string;
    }) =>
      call<{ workflow: DocumentationWorkflow }>({
        action: 'create',
        ...params,
      }).then((r) => r.workflow),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-workflows'] });
    },
    onError: (err: Error) => {
      logger.error('Failed to create workflow:', err);
      showToast(err.message || 'Failed to create workflow', 'error');
    },
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (params: {
      organization_id?: string;
      workflow_id: string;
      name?: string;
      description?: string;
      start_url?: string;
      is_active?: boolean;
      is_playwright_ready?: boolean;
      automation_mode?: string;
      tutorial_group?: string;
      target_role?: string;
      settings?: Record<string, unknown>;
      notes?: string;
    }) =>
      call<{ workflow: DocumentationWorkflow }>({
        action: 'update',
        ...params,
      }).then((r) => r.workflow),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-workflow', vars.workflow_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-workflows'] });
    },
    onError: (err: Error) => {
      logger.error('Failed to update workflow:', err);
      showToast(err.message || 'Failed to update workflow', 'error');
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (workflowId: string) =>
      call<{ success: boolean }>({ action: 'delete', workflow_id: workflowId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-workflows'] });
    },
    onError: (err: Error) => {
      logger.error('Failed to delete workflow:', err);
      showToast(err.message || 'Failed to delete workflow', 'error');
    },
  });
}

export function useWorkflowSteps(workflowId: string | null, organizationId?: string) {
  return useQuery({
    queryKey: ['doc-studio-workflow-steps', workflowId],
    queryFn: () =>
      call<{ steps: DocumentationWorkflowStep[] }>({
        action: 'steps_list',
        workflow_id: workflowId,
        organization_id: organizationId ?? null,
      }).then((r) => r.steps),
    enabled: !!workflowId,
    staleTime: 60 * 1000,
  });
}

export function useUpsertWorkflowStep() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (params: {
      organization_id?: string;
      workflow_id: string;
      id?: string;
      step_order: number;
      title: string;
      description?: string;
      action_type: StepActionType;
      target_selector: string;
      action_value?: string;
      expected_result?: string;
      wait_strategy?: WaitStrategy;
      screenshot_checkpoint?: boolean;
      screenshot_caption_template?: string;
      fallback_instruction?: string;
      timeout_seconds?: number;
      ai_observation_prompt?: string;
      is_optional?: boolean;
      error_handling_strategy?: ErrorHandlingStrategy;
      retry_count?: number;
      selector_strategy?: SelectorStrategy;
    }) =>
      call<{ step: DocumentationWorkflowStep }>({
        action: params.id ? 'step_update' : 'step_create',
        ...params,
      }).then((r) => r.step),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-workflow-steps', vars.workflow_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-workflow', vars.workflow_id] });
    },
    onError: (err: Error) => {
      logger.error('Failed to save workflow step:', err);
      showToast(err.message || 'Failed to save workflow step', 'error');
    },
  });
}

export function useDeleteWorkflowStep() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ stepId, workflowId }: { stepId: string; workflowId: string }) =>
      call<{ success: boolean }>({ action: 'step_delete', step_id: stepId }).then((r) => ({
        ...r,
        workflowId,
      })),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-workflow-steps', result.workflowId] });
    },
    onError: (err: Error) => {
      logger.error('Failed to delete workflow step:', err);
      showToast(err.message || 'Failed to delete workflow step', 'error');
    },
  });
}

export function useReorderWorkflowSteps() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ workflowId, stepOrders }: { workflowId: string; stepOrders: { id: string; step_order: number }[] }) =>
      call<{ success: boolean }>({ action: 'steps_reorder', workflow_id: workflowId, step_orders: stepOrders }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-workflow-steps', vars.workflowId] });
    },
    onError: (err: Error) => {
      logger.error('Failed to reorder workflow steps:', err);
      showToast(err.message || 'Failed to reorder workflow steps', 'error');
    },
  });
}

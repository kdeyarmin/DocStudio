import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { logger } from '../lib/logger';
import type {
  DocumentationJob,
  TriggerJobPayload,
  JobStatus,
  PlaywrightSettings,
} from '../types/documentation';
import { ACTIVE_JOB_STATUSES } from '../types/documentation';
import { getAutomationProvider } from '../providers/automation/AutomationProviderFactory';

const FN = 'doc-studio-jobs';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export function useDocStudioJobs(opts?: {
  workflowId?: string;
  draftId?: string;
  status?: JobStatus | 'all';
  limit?: number;
  organizationId?: string;
}) {
  return useQuery({
    queryKey: ['doc-studio-jobs', opts],
    queryFn: () =>
      call<{ jobs: DocumentationJob[] }>({
        action: 'list',
        organization_id: opts?.organizationId,
        workflow_id: opts?.workflowId,
        draft_id: opts?.draftId,
        status: opts?.status ?? 'all',
        limit: opts?.limit ?? 50,
      }).then((r) => r.jobs),
    staleTime: 30 * 1000,
  });
}

export function useDocStudioJob(jobId: string | null, organizationId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['doc-studio-job', jobId],
    queryFn: () =>
      call<{ job: DocumentationJob }>({
        action: 'get',
        organization_id: organizationId,
        job_id: jobId,
      }).then((r) => r.job),
    enabled: !!jobId,
    staleTime: 5 * 1000,
  });

  const isActive = query.data ? ACTIVE_JOB_STATUSES.includes(query.data.status) : false;

  useEffect(() => {
    if (!jobId || !isActive) return;

    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['doc-studio-job', jobId] });
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, isActive, qc]);

  const prevStatusRef = useRef<JobStatus | undefined>();
  useEffect(() => {
    const status = query.data?.status;
    const draftId = query.data?.draft_id;
    if (prevStatusRef.current !== 'ready_for_review' && status === 'ready_for_review' && draftId) {
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-segments', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-quality', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-quality-history', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
      qc.invalidateQueries({ queryKey: ['doc-studio-jobs'] });
    }
    prevStatusRef.current = status;
  }, [query.data?.status, query.data?.draft_id, qc]);

  return query;
}

export function useDocStudioJobEvents(jobId: string | null, organizationId?: string) {
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const query = useQuery({
    queryKey: ['doc-studio-job-events', jobId],
    queryFn: () =>
      call<{ events: unknown[] }>({
        action: 'get_events',
        organization_id: organizationId,
        job_id: jobId,
      }).then((r) => r.events),
    enabled: !!jobId,
    staleTime: 5 * 1000,
  });

  useEffect(() => {
    // Clean up any existing channel before subscribing to a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!jobId) return;

    const channel = supabase
      .channel(`doc-job-events-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documentation_job_events',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['doc-studio-job-events', jobId] });
          qc.invalidateQueries({ queryKey: ['doc-studio-job', jobId] });
        }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [jobId, qc]);

  return query;
}

export function useTriggerJob(settings: PlaywrightSettings | null) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (payload: TriggerJobPayload) => {
      const provider = getAutomationProvider(settings, payload.provider_mode);
      return provider.createRun(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-jobs'] });
    },
    onError: (err: Error) => {
      logger.error('Failed to trigger job:', err);
      showToast(err.message || 'Failed to trigger job', 'error');
    },
  });
}

export function useCancelJob(settings: PlaywrightSettings | null, _organizationId?: string) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const provider = getAutomationProvider(settings);
      return provider.cancelRun(jobId);
    },
    onSuccess: (_, jobId) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-job', jobId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-jobs'] });
    },
    onError: (err: Error) => {
      logger.error('Failed to cancel job:', err);
      showToast(err.message || 'Failed to cancel job', 'error');
    },
  });
}

export function useJobAssets(jobId: string | null, organizationId?: string) {
  return useQuery({
    queryKey: ['doc-studio-job-assets', jobId],
    queryFn: () =>
      call<{ assets: unknown[] }>({
        action: 'get_assets',
        organization_id: organizationId,
        job_id: jobId,
      }).then((r) => r.assets),
    enabled: !!jobId,
    staleTime: 30 * 1000,
  });
}

export function useCompleteJob(organizationId?: string) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (params: { jobId: string; draftId?: string }) =>
      call<{ success: boolean }>({
        action: 'complete',
        organization_id: organizationId,
        job_id: params.jobId,
        draft_id: params.draftId,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-job', vars.jobId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-job-events', vars.jobId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-jobs'] });
      if (vars.draftId) {
        qc.invalidateQueries({ queryKey: ['doc-studio-draft', vars.draftId] });
        qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
      }
    },
    onError: (err: Error) => {
      logger.error('Failed to complete job:', err);
      showToast(err.message || 'Failed to complete job', 'error');
    },
  });
}

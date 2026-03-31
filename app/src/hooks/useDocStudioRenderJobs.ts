import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '../lib/logger';
import {
  fetchRenderJobsForDraft,
  fetchRenderJob,
  fetchLatestRenderJob,
  fetchRenderJobEvents,
  fetchRenderJobArtifacts,
  fetchRenderArtifactsForDraft,
  fetchRenderQueueStats,
  fetchRenderCommandPlan,
  createRenderJob,
  cancelRenderJob,
  retryRenderJob,
  enqueueAndStartRenderJob,
  CreateRenderJobPayload,
} from '../services/documentation/render/renderJobService';
import {
  ACTIVE_RENDER_STATUSES,
  TERMINAL_RENDER_STATUSES,
  RenderManifest,
  RenderEngineProvider,
  RenderMode,
} from '../types/documentation';

// ─── Read Hooks ───────────────────────────────────────────────────────────────

export function useRenderJobsForDraft(draftId: string | null) {
  return useQuery({
    queryKey: ['render_jobs', draftId],
    queryFn: () => fetchRenderJobsForDraft(draftId!),
    enabled: !!draftId,
    staleTime: 15_000,
  });
}

export function useRenderJob(jobId: string | null) {
  return useQuery({
    queryKey: ['render_job', jobId],
    queryFn: () => fetchRenderJob(jobId!),
    enabled: !!jobId,
    staleTime: 10_000,
  });
}

export function useLatestRenderJob(draftId: string | null) {
  return useQuery({
    queryKey: ['render_job_latest', draftId],
    queryFn: () => fetchLatestRenderJob(draftId!),
    enabled: !!draftId,
    staleTime: 10_000,
  });
}

export function useRenderJobEvents(jobId: string | null) {
  return useQuery({
    queryKey: ['render_job_events', jobId],
    queryFn: () => fetchRenderJobEvents(jobId!),
    enabled: !!jobId,
    staleTime: 5_000,
  });
}

export function useRenderJobArtifacts(jobId: string | null) {
  return useQuery({
    queryKey: ['render_job_artifacts', jobId],
    queryFn: () => fetchRenderJobArtifacts(jobId!),
    enabled: !!jobId,
    staleTime: 30_000,
  });
}

export function useRenderArtifactsForDraft(draftId: string | null) {
  return useQuery({
    queryKey: ['render_artifacts_draft', draftId],
    queryFn: () => fetchRenderArtifactsForDraft(draftId!),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

export function useRenderQueueStats(organizationId: string | null) {
  return useQuery({
    queryKey: ['render_queue_stats', organizationId],
    queryFn: () => fetchRenderQueueStats(organizationId!),
    enabled: !!organizationId,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useRenderCommandPlan(renderJobId: string | null) {
  return useQuery({
    queryKey: ['render_command_plan', renderJobId],
    queryFn: () => fetchRenderCommandPlan(renderJobId!),
    enabled: !!renderJobId,
    staleTime: 60_000,
  });
}

// ─── Polling Hook ─────────────────────────────────────────────────────────────

export function usePolledRenderJob(jobId: string | null) {
  const query = useQuery({
    queryKey: ['render_job_polled', jobId],
    queryFn: () => fetchRenderJob(jobId!),
    enabled: !!jobId,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 2_000;
      if (TERMINAL_RENDER_STATUSES.includes(status)) return false;
      if (ACTIVE_RENDER_STATUSES.includes(status)) return 2_000;
      return false;
    },
  });

  const isActive = query.data ? ACTIVE_RENDER_STATUSES.includes(query.data.status) : false;
  const isTerminal = query.data ? TERMINAL_RENDER_STATUSES.includes(query.data.status) : false;

  return { ...query, isActive, isTerminal };
}

export function usePolledRenderEvents(jobId: string | null, isActive: boolean) {
  return useQuery({
    queryKey: ['render_job_events_polled', jobId],
    queryFn: () => fetchRenderJobEvents(jobId!),
    enabled: !!jobId,
    staleTime: 0,
    refetchInterval: isActive ? 2_000 : false,
  });
}

// ─── Mutation Hooks ───────────────────────────────────────────────────────────

export interface StartRenderJobInput {
  draftId: string;
  organizationId: string;
  renderProjectId?: string | null;
  engineProvider?: RenderEngineProvider;
  renderMode?: RenderMode;
  settingsSnapshot?: Record<string, unknown>;
  manifest?: RenderManifest | null;
}

export function useStartRenderJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartRenderJobInput) => {
      const payload: CreateRenderJobPayload = {
        draftId: input.draftId,
        organizationId: input.organizationId,
        renderProjectId: input.renderProjectId,
        engineProvider: input.engineProvider ?? 'mock',
        renderMode: input.renderMode ?? 'standard_training',
        settingsSnapshot: input.settingsSnapshot,
      };
      return enqueueAndStartRenderJob(payload, input.manifest ?? null);
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['render_jobs', job.draft_id] });
      qc.invalidateQueries({ queryKey: ['render_job_latest', job.draft_id] });
      qc.invalidateQueries({ queryKey: ['render_queue_stats'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRenderJobs] useStartRenderJob failed:', error.message);
    },
  });
}

export function useCancelRenderJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId }: { jobId: string; draftId: string }) => {
      await cancelRenderJob(jobId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_job', vars.jobId] });
      qc.invalidateQueries({ queryKey: ['render_job_polled', vars.jobId] });
      qc.invalidateQueries({ queryKey: ['render_jobs', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['render_job_latest', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['render_queue_stats'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRenderJobs] useCancelRenderJob failed:', error.message);
    },
  });
}

export function useRetryRenderJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, manifest, draftId: _draftId }: { jobId: string; manifest: RenderManifest | null; draftId: string }) => {
      return retryRenderJob(jobId, manifest);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_jobs', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['render_job_latest', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['render_queue_stats'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRenderJobs] useRetryRenderJob failed:', error.message);
    },
  });
}

export function useCreateRenderJobOnly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRenderJobPayload) => createRenderJob(payload),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['render_jobs', job.draft_id] });
      qc.invalidateQueries({ queryKey: ['render_job_latest', job.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRenderJobs] useCreateRenderJobOnly failed:', error.message);
    },
  });
}

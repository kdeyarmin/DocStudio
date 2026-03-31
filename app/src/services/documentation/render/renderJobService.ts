import { supabase } from '../../../lib/supabase';
import {
  RenderJob,
  RenderJobEvent,
  RenderJobArtifact,
  RenderJobStatus,
  RenderEngineProvider,
  RenderMode,
  RenderManifest,
  RenderOutputSummary,
  ACTIVE_RENDER_STATUSES,
} from '../../../types/documentation';
import { logger } from '../../../lib/logger';
import {
  getRenderEngineProvider,
  RenderProgressUpdate,
} from '../../../lib/renderEngineProviders';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchRenderJobsForDraft(draftId: string): Promise<RenderJob[]> {
  const { data, error } = await supabase
    .from('doc_studio_render_jobs')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RenderJob[];
}

export async function fetchRenderJob(jobId: string): Promise<RenderJob> {
  const { data, error } = await supabase
    .from('doc_studio_render_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Render job not found');
  return data as RenderJob;
}

export async function fetchLatestRenderJob(draftId: string): Promise<RenderJob | null> {
  const { data, error } = await supabase
    .from('doc_studio_render_jobs')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RenderJob | null;
}

export async function fetchRenderJobEvents(jobId: string): Promise<RenderJobEvent[]> {
  const { data, error } = await supabase
    .from('doc_studio_render_events')
    .select('*')
    .eq('render_job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RenderJobEvent[];
}

export async function fetchRenderJobArtifacts(jobId: string): Promise<RenderJobArtifact[]> {
  const { data, error } = await supabase
    .from('doc_studio_render_artifacts')
    .select('*')
    .eq('render_job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RenderJobArtifact[];
}

export async function fetchRenderArtifactsForDraft(draftId: string): Promise<RenderJobArtifact[]> {
  const { data, error } = await supabase
    .from('doc_studio_render_artifacts')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RenderJobArtifact[];
}

export interface RenderCommandPlan {
  id: string;
  render_job_id: string;
  draft_id: string;
  organization_id: string;
  command_plan_json: Record<string, unknown>;
  finalize_plan_json: Record<string, unknown>;
  fingerprint_hash: string;
  scene_count: number;
  overlay_count: number;
  audio_track_count: number;
  created_at: string;
}

export async function fetchRenderCommandPlan(renderJobId: string): Promise<RenderCommandPlan | null> {
  const { data, error } = await supabase
    .from('doc_studio_render_command_plans')
    .select('*')
    .eq('render_job_id', renderJobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RenderCommandPlan | null;
}

export interface RenderQueueStats {
  active: number;
  completedToday: number;
  totalCompleted: number;
  failed: number;
}

export async function fetchRenderQueueStats(organizationId: string): Promise<RenderQueueStats> {
  const { data, error } = await supabase
    .from('doc_studio_render_jobs')
    .select('status, completed_at')
    .eq('organization_id', organizationId);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ status: string; completed_at: string | null }>;
  const today = new Date().toISOString().slice(0, 10);
  return {
    active: rows.filter(r => ACTIVE_RENDER_STATUSES.includes(r.status as RenderJobStatus)).length,
    completedToday: rows.filter(r => r.status === 'completed' && r.completed_at?.startsWith(today)).length,
    totalCompleted: rows.filter(r => r.status === 'completed').length,
    failed: rows.filter(r => r.status === 'failed').length,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateRenderJobPayload {
  draftId: string;
  organizationId: string;
  renderProjectId?: string | null;
  engineProvider?: RenderEngineProvider;
  renderMode?: RenderMode;
  settingsSnapshot?: Record<string, unknown>;
}

export async function createRenderJob(payload: CreateRenderJobPayload): Promise<RenderJob> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  const { data, error } = await supabase
    .from('doc_studio_render_jobs')
    .insert({
      draft_id: payload.draftId,
      organization_id: payload.organizationId,
      render_project_id: payload.renderProjectId ?? null,
      engine_provider: payload.engineProvider ?? 'mock',
      render_mode: payload.renderMode ?? 'standard_training',
      status: 'queued',
      progress_percent: 0,
      settings_snapshot_json: payload.settingsSnapshot ?? {},
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  await logRenderEvent(data.id, {
    event_type: 'render_job_created',
    title: 'Render job created',
    description: `Engine: ${payload.engineProvider ?? 'mock'} • Mode: ${payload.renderMode ?? 'standard_training'}`,
    severity: 'info',
    payload_json: { engine_provider: payload.engineProvider ?? 'mock', render_mode: payload.renderMode ?? 'standard_training' },
  });
  return data as RenderJob;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateRenderJobStatus(
  jobId: string,
  status: RenderJobStatus,
  extra?: Partial<Pick<RenderJob, 'progress_percent' | 'current_step' | 'error_message' | 'warning_message' | 'output_summary_json'>>,
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, ...extra };
  if (status === 'preparing_assets') patch.started_at = now;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    patch.completed_at = now;
  }
  const { error } = await supabase
    .from('doc_studio_render_jobs')
    .update(patch)
    .eq('id', jobId);
  if (error) throw error;
}

export async function updateRenderJobProgress(update: RenderProgressUpdate): Promise<void> {
  const { error } = await supabase
    .from('doc_studio_render_jobs')
    .update({
      status: update.status,
      progress_percent: update.progressPercent,
      current_step: update.currentStep,
    })
    .eq('id', update.jobId);
  if (error) throw error;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function logRenderEvent(
  jobId: string,
  event: Omit<RenderJobEvent, 'id' | 'render_job_id' | 'created_at'>,
): Promise<void> {
  const { error } = await supabase
    .from('doc_studio_render_events')
    .insert({ render_job_id: jobId, ...event });
  if (error) logger.error('[RenderJobService] Failed to log render event:', error);
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export async function saveRenderArtifacts(
  jobId: string,
  artifacts: Omit<RenderJobArtifact, 'id' | 'render_job_id' | 'created_at'>[],
): Promise<RenderJobArtifact[]> {
  const rows = artifacts.map(a => ({ ...a, render_job_id: jobId }));
  const { data, error } = await supabase
    .from('doc_studio_render_artifacts')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as RenderJobArtifact[];
}

// ─── Denormalized draft update ────────────────────────────────────────────────

async function updateDraftLatestRender(draftId: string, jobId: string, status: RenderJobStatus): Promise<void> {
  const { error } = await supabase
    .from('documentation_drafts')
    .update({ latest_render_job_id: jobId, latest_render_status: status })
    .eq('id', draftId);
  if (error) logger.error('[RenderJobService] Failed to update draft latest render:', error);
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export async function executeRenderJob(
  jobId: string,
  manifest: RenderManifest | null,
): Promise<{ success: boolean; outputSummary?: RenderOutputSummary; error?: string }> {
  let job: RenderJob;
  try {
    job = await fetchRenderJob(jobId);
  } catch {
    return { success: false, error: 'Render job not found' };
  }

  const provider = getRenderEngineProvider(job.engine_provider);

  if (!provider.available && job.engine_provider !== 'mock') {
    const errMsg = `Render engine "${job.engine_provider}" is not yet available. Use mock mode.`;
    await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg, progress_percent: 0 });
    await logRenderEvent(jobId, { event_type: 'render_failed', title: 'Engine unavailable', description: errMsg, severity: 'error', payload_json: {} });
    await updateDraftLatestRender(job.draft_id, jobId, 'failed');
    return { success: false, error: errMsg };
  }

  if (!manifest) {
    const errMsg = 'Render manifest is missing — cannot start render job.';
    await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg, progress_percent: 0 });
    await logRenderEvent(jobId, { event_type: 'render_failed', title: 'Missing manifest', description: errMsg, severity: 'error', payload_json: {} });
    await updateDraftLatestRender(job.draft_id, jobId, 'failed');
    return { success: false, error: errMsg };
  }

  try {
    await updateDraftLatestRender(job.draft_id, jobId, 'preparing_assets');

    // 1 – Validate manifest
    await updateRenderJobStatus(jobId, 'validating_manifest', { progress_percent: 5, current_step: 'Validating render manifest' });
    const validation = await provider.validateRenderManifest(manifest);
    if (!validation.valid) {
      const errMsg = validation.errors.join('; ');
      await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg, progress_percent: 5 });
      await logRenderEvent(jobId, { event_type: 'render_failed', title: 'Manifest validation failed', description: errMsg, severity: 'error', payload_json: { errors: validation.errors } });
      await updateDraftLatestRender(job.draft_id, jobId, 'failed');
      return { success: false, error: errMsg };
    }
    if (validation.warnings.length > 0) {
      await logRenderEvent(jobId, { event_type: 'warning_issued', title: 'Manifest warnings', description: validation.warnings.join('; '), severity: 'warning', payload_json: { warnings: validation.warnings } });
      await updateRenderJobStatus(jobId, 'validating_manifest', { warning_message: validation.warnings[0] });
    }
    await logRenderEvent(jobId, { event_type: 'manifest_validated', title: 'Manifest validated', description: `${manifest.scene_count} scenes, ${manifest.total_duration_ms}ms total`, severity: 'success', payload_json: { scene_count: manifest.scene_count, warnings: validation.warnings } });

    // 2 – Prepare assets
    await updateRenderJobStatus(jobId, 'preparing_assets', { progress_percent: 10, current_step: 'Preparing render assets' });
    const assetPrep = await provider.prepareRenderAssets(jobId, manifest);
    if (!assetPrep.success) {
      const errMsg = 'Asset preparation failed';
      await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg });
      await logRenderEvent(jobId, { event_type: 'render_failed', title: errMsg, description: null, severity: 'error', payload_json: {} });
      await updateDraftLatestRender(job.draft_id, jobId, 'failed');
      return { success: false, error: errMsg };
    }
    await logRenderEvent(jobId, { event_type: 'assets_prepared', title: 'Assets prepared', description: `${assetPrep.assetCount} assets ready`, severity: 'success', payload_json: { asset_count: assetPrep.assetCount } });

    // 3 – Render
    await logRenderEvent(jobId, { event_type: 'rendering_started', title: 'Render started', description: `Provider: ${job.engine_provider} • Mode: ${job.render_mode}`, severity: 'info', payload_json: { engine: job.engine_provider, mode: job.render_mode } });
    const renderResult = await provider.renderProject(jobId, manifest, async (update: RenderProgressUpdate) => {
      await updateRenderJobProgress(update);
      await logRenderEvent(jobId, {
        event_type: 'render_progress',
        title: update.currentStep,
        description: `${update.progressPercent}% complete`,
        severity: 'info',
        payload_json: { progress_percent: update.progressPercent, status: update.status },
      });
    });
    if (!renderResult.success) {
      const errMsg = renderResult.error ?? 'Render failed';
      await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg });
      await logRenderEvent(jobId, { event_type: 'render_failed', title: 'Render failed', description: errMsg, severity: 'error', payload_json: {} });
      await updateDraftLatestRender(job.draft_id, jobId, 'failed');
      return { success: false, error: errMsg };
    }
    await logRenderEvent(jobId, { event_type: 'encoding_started', title: 'Encoding started', description: null, severity: 'info', payload_json: {} });

    // 4 – Finalize
    await updateRenderJobStatus(jobId, 'finalizing_assets', { progress_percent: 95, current_step: 'Saving render artifacts' });
    const finalResult = await provider.finalizeRenderOutput(jobId, manifest);
    if (!finalResult.success || !finalResult.outputSummary) {
      const errMsg = finalResult.error ?? 'Finalization failed';
      await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg });
      await logRenderEvent(jobId, { event_type: 'render_failed', title: 'Finalization failed', description: errMsg, severity: 'error', payload_json: {} });
      await updateDraftLatestRender(job.draft_id, jobId, 'failed');
      return { success: false, error: errMsg };
    }

    // 5 – Save artifacts
    if (finalResult.artifacts && finalResult.artifacts.length > 0) {
      const artifactRows = finalResult.artifacts.map(a => ({
        draft_id: a.draft_id,
        artifact_type: a.artifact_type,
        file_name: a.file_name,
        file_url: a.file_url,
        file_size: a.file_size,
        mime_type: a.mime_type,
        duration_ms: a.duration_ms,
        width: a.width,
        height: a.height,
        is_mock: a.is_mock,
        metadata_json: a.metadata_json,
      }));
      await saveRenderArtifacts(jobId, artifactRows);
    }
    await logRenderEvent(jobId, { event_type: 'final_asset_saved', title: 'Artifacts saved', description: `${finalResult.artifacts?.length ?? 0} artifacts created`, severity: 'success', payload_json: { artifact_count: finalResult.artifacts?.length ?? 0 } });

    // 6 – Complete
    const now = new Date().toISOString();
    const startedAt = job.started_at ?? now;
    const durationSeconds = (new Date(now).getTime() - new Date(startedAt).getTime()) / 1000;
    await updateRenderJobStatus(jobId, 'completed', {
      progress_percent: 100,
      current_step: 'Render complete',
      output_summary_json: finalResult.outputSummary as unknown as RenderJob['output_summary_json'],
    });
    await supabase.from('doc_studio_render_jobs').update({ duration_seconds: durationSeconds }).eq('id', jobId).eq('organization_id', job.organization_id);
    await logRenderEvent(jobId, { event_type: 'render_completed', title: 'Render completed', description: `${finalResult.artifacts?.length ?? 0} artifacts • ${finalResult.outputSummary.is_mock ? 'Mock output' : 'Real output'}`, severity: 'success', payload_json: { output_summary: finalResult.outputSummary } });
    await updateDraftLatestRender(job.draft_id, jobId, 'completed');

    return { success: true, outputSummary: finalResult.outputSummary };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown render error';
    logger.error('[RenderJobService] executeRenderJob error:', err);
    await updateRenderJobStatus(jobId, 'failed', { error_message: errMsg });
    await logRenderEvent(jobId, { event_type: 'render_failed', title: 'Unexpected error', description: errMsg, severity: 'error', payload_json: {} });
    try { await updateDraftLatestRender(job.draft_id, jobId, 'failed'); } catch { /* best-effort draft status update */ }
    return { success: false, error: errMsg };
  }
}

export async function cancelRenderJob(jobId: string): Promise<void> {
  const job = await fetchRenderJob(jobId);
  if (!ACTIVE_RENDER_STATUSES.includes(job.status)) return;
  const provider = getRenderEngineProvider(job.engine_provider);
  await provider.cancelRender(jobId);
  await updateRenderJobStatus(jobId, 'cancelled', { current_step: 'Cancelled by user' });
  await logRenderEvent(jobId, { event_type: 'render_cancelled', title: 'Render cancelled', description: 'Cancelled by user', severity: 'warning', payload_json: {} });
  await updateDraftLatestRender(job.draft_id, jobId, 'cancelled');
}

export async function retryRenderJob(originalJobId: string, manifest: RenderManifest | null): Promise<{ jobId: string }> {
  const original = await fetchRenderJob(originalJobId);
  const newJob = await createRenderJob({
    draftId: original.draft_id,
    organizationId: original.organization_id,
    renderProjectId: original.render_project_id,
    engineProvider: original.engine_provider,
    renderMode: original.render_mode,
    settingsSnapshot: original.settings_snapshot_json as Record<string, unknown>,
  });
  await logRenderEvent(newJob.id, { event_type: 'render_job_created', title: 'Retry render job', description: `Retry of job ${originalJobId}`, severity: 'info', payload_json: { original_job_id: originalJobId } });
  executeRenderJob(newJob.id, manifest).catch(console.error);
  return { jobId: newJob.id };
}

export async function enqueueAndStartRenderJob(
  payload: CreateRenderJobPayload,
  manifest: RenderManifest | null,
): Promise<RenderJob> {
  const job = await createRenderJob(payload);
  executeRenderJob(job.id, manifest).catch(console.error);
  return job;
}

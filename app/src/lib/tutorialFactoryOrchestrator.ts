import { supabase } from './supabase';
import {
  RenderEngineProvider,
  RenderMode,
  RenderConfig,
  RenderManifest,
  DEFAULT_RENDER_SETTINGS,
} from '../types/documentation';
import {
  createRenderProject,
  fetchRenderProjects,
  updateRenderConfig,
  persistRenderManifest,
} from '../services/documentation/render/renderProjectService';
import { buildRenderManifest } from '../services/documentation/render/renderManifestService';
import { enqueueAndStartRenderJob } from '../services/documentation/render/renderJobService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiveStageStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface PipelineStageResult {
  stage: string;
  status: 'skipped' | 'completed' | 'failed';
  durationMs: number;
  detail?: string;
}

export interface TutorialFactoryOptions {
  draftId: string;
  organizationId: string;
  engineProvider?: RenderEngineProvider;
  renderMode?: RenderMode;
  captionMode?: 'auto' | 'none' | 'burn_in';
  includeOverlays?: boolean;
  includeBurnInCaptions?: boolean;
  includeExternalSubtitles?: boolean;
  outputResolution?: '720p' | '1080p' | '4k';
  frameRate?: 24 | 30 | 60;
  activeVariantId?: string | null;
  onStageStart?: (stageName: string, stageIndex: number, total: number) => void;
  onStageComplete?: (stage: PipelineStageResult, stageIndex: number, total: number) => void;
}

export interface TutorialFactoryResult {
  success: boolean;
  jobId: string | null;
  renderProjectId: string | null;
  stages: PipelineStageResult[];
  warnings: string[];
  error?: string;
  totalElapsedMs: number;
}

export interface DraftAssetSummary {
  hasScenesAssembled: boolean;
  hasNarration: boolean;
  hasRenderProject: boolean;
  existingRenderProjectId: string | null;
  sceneCount: number;
  narrationCount: number;
  latestCompletedJobId: string | null;
  latestCompletedJobAt: string | null;
  latestCompletedJobMode: string | null;
  hasCachedManifest: boolean;
}

// ─── Internal detail type ─────────────────────────────────────────────────────

interface DraftDetails extends DraftAssetSummary {
  organizationId: string;
  contentUpdatedAt: string | null;
  existingRenderConfigJson: RenderConfig | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const PIPELINE_STAGE_NAMES = [
  'Resolve draft assets',
  'Verify scene assembly',
  'Verify narration segments',
  'Build render project',
  'Build render manifest',
  'Execute render job',
] as const;

export type PipelineStageName = typeof PIPELINE_STAGE_NAMES[number];

function buildRenderConfig(opts: TutorialFactoryOptions): RenderConfig {
  const base = DEFAULT_RENDER_SETTINGS;
  const resolutionMap: Record<string, { width: number; height: number }> = {
    '720p':  { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4k':    { width: 3840, height: 2160 },
  };
  const resolution = resolutionMap[opts.outputResolution ?? '1080p'];
  return {
    video: {
      ...base.default_video_config,
      width: resolution.width,
      height: resolution.height,
      fps: opts.frameRate ?? 30,
    },
    captions: {
      ...base.default_caption_config,
      enabled: opts.captionMode !== 'none',
      burn_in: opts.includeBurnInCaptions ?? false,
    },
    callouts: {
      ...base.default_callout_config,
      enabled: opts.includeOverlays ?? true,
    },
    transitions: base.default_transition_config,
  };
}

export function buildSettingsFingerprint(opts: Pick<TutorialFactoryOptions, 'renderMode' | 'outputResolution' | 'frameRate' | 'captionMode' | 'includeOverlays'>): string {
  return [
    opts.renderMode ?? 'standard_training',
    opts.outputResolution ?? '1080p',
    opts.frameRate ?? 30,
    opts.captionMode ?? 'auto',
    opts.includeOverlays ? '1' : '0',
  ].join('|');
}

function configToFingerprint(config: RenderConfig): string {
  const res = config.video.width === 1280 ? '720p' : config.video.width === 3840 ? '4k' : '1080p';
  const caption = !config.captions.enabled ? 'none' : config.captions.burn_in ? 'burn_in' : 'auto';
  return [res, config.video.fps, caption, config.callouts.enabled ? '1' : '0'].join('|');
}

async function resolveDraftDetails(draftId: string): Promise<DraftDetails> {
  const { data: draft } = await supabase
    .from('doc_studio_drafts')
    .select('id, organization_id, assembly_status, narration_segment_count, scene_count, updated_at')
    .eq('id', draftId)
    .maybeSingle();

  const d = draft as Record<string, unknown> | null;
  const hasScenesAssembled = !!(d?.assembly_status && d.assembly_status !== 'pending');
  const hasNarration = ((d?.narration_segment_count as number) ?? 0) > 0;
  const contentUpdatedAt = (d?.updated_at ?? null) as string | null;

  const [{ data: sceneRows }, { data: narrationRows }] = await Promise.all([
    supabase.from('doc_studio_scenes').select('id').eq('draft_id', draftId),
    supabase.from('doc_studio_narration_segments').select('id').eq('draft_id', draftId),
  ]);

  const sceneCount = (sceneRows ?? []).length;
  const narrationCount = (narrationRows ?? []).length;

  const existingProjects = await fetchRenderProjects(draftId).catch(() => []);
  const existingProject = existingProjects.length > 0 ? existingProjects[0] : null;
  const existingRenderProjectId = existingProject?.id ?? null;
  const existingRenderConfigJson = (existingProject as Record<string, unknown> | null)?.render_config_json as RenderConfig | null ?? null;
  const hasCachedManifest = !!(existingProject as Record<string, unknown> | null)?.render_manifest_json;

  const { data: latestJob } = await supabase
    .from('doc_studio_render_jobs')
    .select('id, completed_at, render_mode, settings_snapshot_json')
    .eq('draft_id', draftId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lj = latestJob as Record<string, unknown> | null;

  return {
    organizationId: (d?.organization_id as string) ?? '',
    hasScenesAssembled: sceneCount > 0 || hasScenesAssembled,
    hasNarration: narrationCount > 0 || hasNarration,
    hasRenderProject: !!existingRenderProjectId,
    existingRenderProjectId,
    existingRenderConfigJson,
    sceneCount,
    narrationCount,
    latestCompletedJobId: (lj?.id as string) ?? null,
    latestCompletedJobAt: (lj?.completed_at as string) ?? null,
    latestCompletedJobMode: (lj?.render_mode as string) ?? null,
    hasCachedManifest,
    contentUpdatedAt,
  };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function generateFinishedTutorial(opts: TutorialFactoryOptions): Promise<TutorialFactoryResult> {
  const stages: PipelineStageResult[] = [];
  const warnings: string[] = [];
  let renderProjectId: string | null = null;
  let jobId: string | null = null;
  const total = PIPELINE_STAGE_NAMES.length;
  const globalStart = Date.now();
  let stageIndex = 0;

  const resolveStage = async (
    stageName: PipelineStageName,
    fn: () => Promise<{ skipped?: boolean; detail?: string }>,
  ): Promise<boolean> => {
    const idx = stageIndex++;
    opts.onStageStart?.(stageName, idx, total);
    const start = Date.now();
    try {
      const result = await fn();
      const stageResult: PipelineStageResult = {
        stage: stageName,
        status: result.skipped ? 'skipped' : 'completed',
        durationMs: Date.now() - start,
        detail: result.detail,
      };
      stages.push(stageResult);
      opts.onStageComplete?.(stageResult, idx, total);
      return true;
    } catch (err) {
      const stageResult: PipelineStageResult = {
        stage: stageName,
        status: 'failed',
        durationMs: Date.now() - start,
        detail: err instanceof Error ? err.message : 'Unknown error',
      };
      stages.push(stageResult);
      opts.onStageComplete?.(stageResult, idx, total);
      return false;
    }
  };

  // ── Stage 1: Resolve draft state ─────────────────────────────────────────
  let draftState: DraftDetails;
  const resolved = await resolveStage('Resolve draft assets', async () => {
    draftState = await resolveDraftDetails(opts.draftId);
    if (!draftState.organizationId && opts.organizationId) {
      draftState = { ...draftState, organizationId: opts.organizationId };
    }
    if (!draftState.organizationId) throw new Error('Draft not found or missing organization');
    const scenePart = draftState.sceneCount > 0
      ? `${draftState.sceneCount} scenes`
      : 'no scenes';
    const narPart = draftState.narrationCount > 0
      ? `${draftState.narrationCount} narration segments`
      : 'no narration';
    return { detail: `Found ${scenePart}, ${narPart}` };
  });
  if (!resolved) {
    return { success: false, jobId: null, renderProjectId: null, stages, warnings, error: stages[stages.length - 1].detail, totalElapsedMs: Date.now() - globalStart };
  }

  const orgId = draftState!.organizationId || opts.organizationId;

  // ── Stage 2: Verify scenes ───────────────────────────────────────────────
  await resolveStage('Verify scene assembly', async () => {
    if (!draftState!.hasScenesAssembled) {
      warnings.push('No scenes assembled — render will use empty timeline');
      return { detail: 'No scenes found — proceeding with warnings' };
    }
    return { detail: `${draftState!.sceneCount} scene${draftState!.sceneCount !== 1 ? 's' : ''} ready` };
  });

  // ── Stage 3: Verify narration ────────────────────────────────────────────
  await resolveStage('Verify narration segments', async () => {
    if (!draftState!.hasNarration) {
      warnings.push('No narration segments found — video will be silent');
      return { detail: 'No narration — proceeding silently' };
    }
    return { detail: `${draftState!.narrationCount} segment${draftState!.narrationCount !== 1 ? 's' : ''} ready` };
  });

  // ── Stage 4: Create or reuse render project ───────────────────────────────
  const renderConfig = buildRenderConfig(opts);
  const newFingerprint = buildSettingsFingerprint(opts);

  const renderProjectResolved = await resolveStage('Build render project', async () => {
    if (draftState!.hasRenderProject && draftState!.existingRenderProjectId) {
      renderProjectId = draftState!.existingRenderProjectId;

      const existingFingerprint = draftState!.existingRenderConfigJson
        ? configToFingerprint(draftState!.existingRenderConfigJson)
        : null;

      if (existingFingerprint && existingFingerprint !== newFingerprint) {
        await updateRenderConfig(renderProjectId, renderConfig);
        return { skipped: false, detail: `Reused project ${renderProjectId} — settings updated` };
      }

      return { skipped: true, detail: `Reused project ${renderProjectId} — settings unchanged` };
    }
    const project = await createRenderProject({
      draft_id: opts.draftId,
      organization_id: orgId,
      render_mode: opts.renderMode ?? 'standard_training',
      render_config_json: renderConfig,
    });
    renderProjectId = project.id;
    return { detail: `Created new render project` };
  });
  if (!renderProjectResolved) {
    return { success: false, jobId: null, renderProjectId, stages, warnings, error: stages[stages.length - 1].detail, totalElapsedMs: Date.now() - globalStart };
  }

  // ── Stage 5: Build render manifest ───────────────────────────────────────
  let manifest: RenderManifest | null = null;

  const contentChangedSinceLastJob = (() => {
    if (!draftState!.latestCompletedJobAt || !draftState!.contentUpdatedAt) return true;
    return new Date(draftState!.contentUpdatedAt) > new Date(draftState!.latestCompletedJobAt);
  })();

  const canReuseManifest = draftState!.hasCachedManifest && !contentChangedSinceLastJob;

  await resolveStage('Build render manifest', async () => {
    if (canReuseManifest) {
      const { data: projectRow } = await supabase
        .from('doc_studio_render_projects')
        .select('render_manifest_json')
        .eq('id', renderProjectId!)
        .maybeSingle();
      const cached = (projectRow as { render_manifest_json?: RenderManifest | null } | null)?.render_manifest_json;
      if (cached) {
        manifest = cached;
        return { skipped: true, detail: 'Reused cached render manifest — content unchanged' };
      }
    }

    try {
      manifest = await buildRenderManifest({
        renderProjectId: renderProjectId!,
        draftId: opts.draftId,
        renderMode: opts.renderMode ?? 'standard_training',
        renderConfig,
      });
      await persistRenderManifest(
        renderProjectId!,
        manifest,
        manifest.total_duration_ms,
        manifest.scene_count,
      );
      return { detail: `Built manifest: ${manifest.scene_count} scenes, ${manifest.total_duration_ms}ms total` };
    } catch {
      warnings.push('Could not build full manifest — using minimal manifest');
      manifest = {
        render_project_id: renderProjectId!,
        draft_id: opts.draftId,
        draft_title: 'Tutorial',
        render_mode: opts.renderMode ?? 'standard_training',
        render_config: renderConfig,
        total_duration_ms: 180_000,
        scene_count: 0,
        scenes: [],
        generated_at: new Date().toISOString(),
        schema_version: '1.0',
      };
      return { detail: 'Minimal manifest used — scene build failed' };
    }
  });

  // ── Stage 6: Create and execute render job ────────────────────────────────
  const renderJobResolved = await resolveStage('Execute render job', async () => {
    const job = await enqueueAndStartRenderJob({
      draftId: opts.draftId,
      organizationId: orgId,
      renderProjectId: renderProjectId ?? undefined,
      engineProvider: opts.engineProvider ?? 'mock',
      renderMode: opts.renderMode ?? 'standard_training',
      settingsSnapshot: renderConfig as unknown as Record<string, unknown>,
    }, manifest);
    jobId = job.id;
    return { detail: `Job queued with ${opts.engineProvider ?? 'mock'} engine` };
  });
  if (!renderJobResolved) {
    return { success: false, jobId, renderProjectId, stages, warnings, error: stages[stages.length - 1].detail, totalElapsedMs: Date.now() - globalStart };
  }

  return { success: true, jobId, renderProjectId, stages, warnings, totalElapsedMs: Date.now() - globalStart };
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function resolveReusableDraftAssets(draftId: string): Promise<DraftAssetSummary> {
  const state = await resolveDraftDetails(draftId);
  return {
    hasScenesAssembled: state.hasScenesAssembled,
    hasNarration: state.hasNarration,
    hasRenderProject: state.hasRenderProject,
    existingRenderProjectId: state.existingRenderProjectId,
    sceneCount: state.sceneCount,
    narrationCount: state.narrationCount,
    latestCompletedJobId: state.latestCompletedJobId,
    latestCompletedJobAt: state.latestCompletedJobAt,
    latestCompletedJobMode: state.latestCompletedJobMode,
    hasCachedManifest: state.hasCachedManifest,
  };
}

export function summarizePipelineResults(result: TutorialFactoryResult): string {
  const completed = result.stages.filter(s => s.status === 'completed').length;
  const skipped = result.stages.filter(s => s.status === 'skipped').length;
  const failed = result.stages.filter(s => s.status === 'failed').length;
  const parts = [`${completed} phases completed`];
  if (skipped > 0) parts.push(`${skipped} reused`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (result.warnings.length > 0) parts.push(`${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`);
  return parts.join(' · ');
}

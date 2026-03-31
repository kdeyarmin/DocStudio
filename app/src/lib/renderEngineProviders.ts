import {
  RenderEngineProvider,
  RenderJob,
  RenderJobArtifact,
  RenderManifest,
  RenderMode,
  RenderOutputSummary,
  RENDER_JOB_STATUS_LABELS,
} from '../types/documentation';
import { supabase } from './supabase';
import {
  assembleFfmpegCommandPlan,
  buildFfmpegAudioMixPlan,
  buildFfmpegOverlayGraph,
  buildFfmpegSceneCommands,
  buildFfmpegSubtitlePlan,
  buildFfmpegTransitions,
  buildFinalizePlan,
} from './ffmpeg';
import {
  assembleRemotionCompositionPlan,
  buildAllOverlayPlans,
  buildCaptionSequences,
  buildNarrationSyncPlan,
  buildRemotionCompositionProps,
  buildRemotionFinalizePlan,
  buildTransitionSequences,
} from './remotion';
import type {
  RemotionExecutorFinalizeResponse,
  RemotionExecutorProgressResponse,
} from './remotion';

// ─── Render Engine Provider Interface ────────────────────────────────────────

interface CreateRenderJobInput {
  draftId: string;
  renderProjectId: string | null;
  organizationId: string;
  engineProvider: RenderEngineProvider;
  renderMode: RenderMode;
  settingsSnapshot: Record<string, unknown>;
  createdBy: string | null;
}

interface RenderJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface RenderProgressUpdate {
  jobId: string;
  status: RenderJob['status'];
  progressPercent: number;
  currentStep: string;
}

interface FinalizeResult {
  success: boolean;
  outputSummary?: RenderOutputSummary;
  artifacts?: RenderJobArtifact[];
  error?: string;
}

interface ExportArtifactsResult {
  success: boolean;
  downloadUrls?: Record<string, string>;
  error?: string;
}

interface IRenderEngineProvider {
  readonly provider: RenderEngineProvider;
  readonly label: string;
  readonly available: boolean;

  createRenderJob(input: CreateRenderJobInput): Promise<RenderJobResult>;
  validateRenderManifest(manifest: RenderManifest | null): Promise<{ valid: boolean; warnings: string[]; errors: string[] }>;
  prepareRenderAssets(jobId: string, manifest: RenderManifest): Promise<{ success: boolean; assetCount: number; warnings: string[] }>;
  renderProject(jobId: string, manifest: RenderManifest, onProgress: (update: RenderProgressUpdate) => void): Promise<{ success: boolean; error?: string }>;
  getRenderProgress(jobId: string): Promise<RenderProgressUpdate>;
  finalizeRenderOutput(jobId: string, manifest: RenderManifest): Promise<FinalizeResult>;
  cancelRender(jobId: string): Promise<{ success: boolean }>;
  exportRenderArtifacts(jobId: string): Promise<ExportArtifactsResult>;
}

// ─── Mock Render Engine Provider ─────────────────────────────────────────────

const MOCK_RENDER_STEPS: Array<{ status: RenderJob['status']; label: string; durationMs: number; progress: number }> = [
  { status: 'preparing_assets',    label: 'Loading scene assets and screenshots',    durationMs: 400,  progress: 10 },
  { status: 'validating_manifest', label: 'Validating render manifest integrity',    durationMs: 300,  progress: 20 },
  { status: 'rendering_timeline',  label: 'Building composite scene timeline',       durationMs: 600,  progress: 40 },
  { status: 'encoding_video',      label: 'Encoding video frames and transitions',   durationMs: 800,  progress: 65 },
  { status: 'generating_preview',  label: 'Generating preview clip and thumbnail',   durationMs: 300,  progress: 80 },
  { status: 'finalizing_assets',   label: 'Saving render artifacts and metadata',    durationMs: 200,  progress: 95 },
];

const MOCK_DURATIONS_BY_MODE: Record<RenderMode, { videoMs: number; previewMs: number }> = {
  quick_preview:        { videoMs: 90_000,   previewMs: 15_000 },
  standard_training:    { videoMs: 300_000,  previewMs: 30_000 },
  detailed_walkthrough: { videoMs: 600_000,  previewMs: 45_000 },
};

const MOCK_FILESIZES_BY_MODE: Record<RenderMode, { videoBytes: number; previewBytes: number }> = {
  quick_preview:        { videoBytes: 18_500_000,  previewBytes: 3_200_000 },
  standard_training:    { videoBytes: 62_000_000,  previewBytes: 9_400_000 },
  detailed_walkthrough: { videoBytes: 124_000_000, previewBytes: 18_800_000 },
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

class MockRenderEngineProvider implements IRenderEngineProvider {
  readonly provider: RenderEngineProvider = 'mock';
  readonly label = 'Mock Renderer';
  readonly available = true;

  async createRenderJob(input: CreateRenderJobInput): Promise<RenderJobResult> {
    return { success: true, jobId: input.draftId };
  }

  async validateRenderManifest(manifest: RenderManifest | null): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
    if (!manifest) {
      return { valid: false, warnings: [], errors: ['Render manifest is null — run assembly first'] };
    }
    const warnings: string[] = [];
    if (manifest.scene_count === 0) {
      warnings.push('No scenes found in manifest — output will be empty');
    }
    if (!manifest.scenes.some(s => s.narration !== null)) {
      warnings.push('No narration audio attached — video will be silent');
    }
    if (!manifest.scenes.some(s => s.captions.length > 0)) {
      warnings.push('No captions found — consider adding captions for accessibility');
    }
    return { valid: true, warnings, errors: [] };
  }

  async prepareRenderAssets(_jobId: string, manifest: RenderManifest): Promise<{ success: boolean; assetCount: number; warnings: string[] }> {
    await sleep(100);
    const assetCount = manifest.scenes.reduce((n, s) => n + s.screenshot_overlays.length + (s.narration ? 1 : 0), 0);
    return { success: true, assetCount, warnings: [] };
  }

  async renderProject(
    jobId: string,
    _manifest: RenderManifest,
    onProgress: (update: RenderProgressUpdate) => void,
  ): Promise<{ success: boolean; error?: string }> {
    for (const step of MOCK_RENDER_STEPS) {
      await sleep(step.durationMs);
      onProgress({
        jobId,
        status: step.status,
        progressPercent: step.progress,
        currentStep: step.label,
      });
    }
    return { success: true };
  }

  async getRenderProgress(jobId: string): Promise<RenderProgressUpdate> {
    return {
      jobId,
      status: 'encoding_video',
      progressPercent: 65,
      currentStep: RENDER_JOB_STATUS_LABELS['encoding_video'],
    };
  }

  async finalizeRenderOutput(_jobId: string, manifest: RenderManifest): Promise<FinalizeResult> {
    await sleep(100);
    const durations = MOCK_DURATIONS_BY_MODE[manifest.render_mode];
    const sizes = MOCK_FILESIZES_BY_MODE[manifest.render_mode];
    const draftSlug = manifest.draft_title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const now = new Date().toISOString();

    const artifacts: Omit<RenderJobArtifact, 'id' | 'render_job_id'>[] = [
      {
        draft_id: manifest.draft_id,
        artifact_type: 'rendered_video',
        file_name: `${draftSlug}-${manifest.render_mode}.mp4`,
        file_url: null,
        file_size: sizes.videoBytes,
        mime_type: 'video/mp4',
        duration_ms: durations.videoMs,
        width: 1920,
        height: 1080,
        is_mock: true,
        metadata_json: { render_mode: manifest.render_mode, scene_count: manifest.scene_count },
        created_at: now,
      },
      {
        draft_id: manifest.draft_id,
        artifact_type: 'render_preview',
        file_name: `${draftSlug}-preview.mp4`,
        file_url: null,
        file_size: sizes.previewBytes,
        mime_type: 'video/mp4',
        duration_ms: durations.previewMs,
        width: 1280,
        height: 720,
        is_mock: true,
        metadata_json: { preview_for: manifest.render_mode },
        created_at: now,
      },
      {
        draft_id: manifest.draft_id,
        artifact_type: 'render_thumbnail',
        file_name: `${draftSlug}-thumb.jpg`,
        file_url: null,
        file_size: 145_000,
        mime_type: 'image/jpeg',
        duration_ms: null,
        width: 1920,
        height: 1080,
        is_mock: true,
        metadata_json: { capture_at_ms: 2000 },
        created_at: now,
      },
      {
        draft_id: manifest.draft_id,
        artifact_type: 'subtitle_srt',
        file_name: `${draftSlug}.srt`,
        file_url: null,
        file_size: 8_400,
        mime_type: 'text/plain',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: true,
        metadata_json: { caption_count: manifest.scenes.reduce((n, s) => n + s.captions.length, 0) },
        created_at: now,
      },
      {
        draft_id: manifest.draft_id,
        artifact_type: 'subtitle_vtt',
        file_name: `${draftSlug}.vtt`,
        file_url: null,
        file_size: 9_200,
        mime_type: 'text/vtt',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: true,
        metadata_json: { caption_count: manifest.scenes.reduce((n, s) => n + s.captions.length, 0) },
        created_at: now,
      },
      {
        draft_id: manifest.draft_id,
        artifact_type: 'render_manifest_export',
        file_name: `${draftSlug}-manifest.json`,
        file_url: null,
        file_size: JSON.stringify(manifest).length,
        mime_type: 'application/json',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: true,
        metadata_json: { schema_version: manifest.schema_version },
        created_at: now,
      },
    ];

    const outputSummary: RenderOutputSummary = {
      engine_provider: 'mock',
      render_mode: manifest.render_mode,
      total_duration_ms: durations.videoMs,
      output_resolution: '1920x1080',
      fps: 30,
      file_size_bytes: sizes.videoBytes,
      has_subtitles: true,
      has_preview: true,
      has_thumbnail: true,
      artifact_count: artifacts.length,
      completed_at: now,
      is_mock: true,
    };

    return {
      success: true,
      outputSummary,
      artifacts: artifacts as RenderJobArtifact[],
    };
  }

  async cancelRender(_jobId: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async exportRenderArtifacts(_jobId: string): Promise<ExportArtifactsResult> {
    return {
      success: true,
      downloadUrls: {
        rendered_video: '#mock-video',
        render_preview: '#mock-preview',
        subtitle_srt: '#mock-srt',
        subtitle_vtt: '#mock-vtt',
      },
    };
  }
}

// ─── FFmpeg Provider ──────────────────────────────────────────────────────────

const FFMPEG_EXECUTOR_FUNCTION = 'ffmpeg-render-executor';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 1800;

class FfmpegRenderProvider implements IRenderEngineProvider {
  readonly provider: RenderEngineProvider = 'ffmpeg';
  readonly label = 'FFmpeg';
  readonly available = true;

  async createRenderJob(input: CreateRenderJobInput): Promise<RenderJobResult> {
    const { data, error } = await supabase
      .from('doc_studio_render_jobs')
      .insert({
        draft_id: input.draftId,
        render_project_id: input.renderProjectId,
        organization_id: input.organizationId,
        engine_provider: 'ffmpeg',
        render_mode: input.renderMode,
        status: 'queued',
        progress_percent: 0,
        settings_snapshot_json: input.settingsSnapshot,
        created_by: input.createdBy,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Failed to create render job' };
    }

    return { success: true, jobId: data.id };
  }

  async validateRenderManifest(
    manifest: RenderManifest | null,
  ): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
    if (!manifest) {
      return { valid: false, warnings: [], errors: ['Render manifest is null — run assembly first'] };
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const { video } = manifest.render_config;

    const supportedCodecs = ['h264', 'vp9', 'av1'];
    if (!supportedCodecs.includes(video.codec)) {
      errors.push(`Unsupported codec "${video.codec}" — supported: ${supportedCodecs.join(', ')}`);
    }

    if (video.width % 2 !== 0 || video.height % 2 !== 0) {
      errors.push(`Resolution ${video.width}x${video.height} must have even dimensions for FFmpeg`);
    }

    const maxBitrate = video.width >= 3840 ? 50000 : video.width >= 1920 ? 20000 : 10000;
    if (video.bitrate_kbps && video.bitrate_kbps > maxBitrate) {
      warnings.push(`Bitrate ${video.bitrate_kbps}kbps is unusually high for ${video.width}x${video.height} — consider ≤${maxBitrate}kbps`);
    }

    for (const scene of manifest.scenes) {
      for (const seg of scene.video_segments) {
        if (!seg.source_asset_id) {
          errors.push(`Scene "${scene.title}" has a segment with no source asset — cannot render`);
        }
        if (seg.source_end_ms <= seg.source_start_ms) {
          errors.push(`Scene "${scene.title}" segment has zero or negative duration`);
        }
      }

      for (const ovl of scene.screenshot_overlays) {
        if (!ovl.file_url) {
          warnings.push(`Scene "${scene.title}" has an overlay with no file URL — will be skipped`);
        }
        if (ovl.zoom_region) {
          const { x, y, width, height } = ovl.zoom_region;
          if (x < 0 || y < 0 || x + width > video.width || y + height > video.height) {
            warnings.push(`Scene "${scene.title}" zoom region extends outside frame bounds`);
          }
        }
      }
    }

    if (manifest.scene_count === 0) {
      warnings.push('No scenes in manifest — output will be empty');
    }

    if (!manifest.scenes.some(s => s.narration !== null)) {
      warnings.push('No narration audio — video will be silent');
    }

    if (!manifest.scenes.some(s => s.captions.length > 0)) {
      warnings.push('No captions found — consider adding for accessibility');
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  async prepareRenderAssets(
    jobId: string,
    manifest: RenderManifest,
  ): Promise<{ success: boolean; assetCount: number; warnings: string[] }> {
    const config = manifest.render_config;
    const warnings: string[] = [];

    const sceneCommands = buildFfmpegSceneCommands(manifest);

    const sceneVideoLabels = sceneCommands.map(c => c.outputVideoLabel);
    const sourceVideoInputCount = sceneCommands.reduce((count, scene) => count + scene.segments.length, 0);
    const lastSceneVideoLabel = sceneVideoLabels[sceneVideoLabels.length - 1] ?? 'v_out';

    const [overlayGraph, audioMixPlan] = await Promise.all([
      Promise.resolve(buildFfmpegOverlayGraph(
        manifest,
        config,
        sceneVideoLabels,
        sourceVideoInputCount,
      )),
      Promise.resolve(buildFfmpegAudioMixPlan(manifest, sourceVideoInputCount)),
    ]);

    const subtitlePlan = buildFfmpegSubtitlePlan(
      manifest,
      config,
      overlayGraph.finalSceneVideoLabels[overlayGraph.finalSceneVideoLabels.length - 1] ?? lastSceneVideoLabel,
      'v_final_subs',
      jobId,
    );

    const transitions = buildFfmpegTransitions(
      manifest,
      config,
      sceneVideoLabels,
      sceneCommands.map(c => c.outputAudioLabel),
    );

    const commandPlan = assembleFfmpegCommandPlan(
      jobId,
      manifest.draft_id,
      manifest.render_project_id,
      sceneCommands,
      overlayGraph,
      audioMixPlan,
      subtitlePlan,
      transitions,
      config,
      manifest.total_duration_ms,
    );

    const draftSlug = manifest.draft_title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const { data: jobRow } = await supabase
      .from('doc_studio_render_jobs')
      .select('organization_id')
      .eq('id', jobId)
      .maybeSingle();

    const organizationId = jobRow?.organization_id ?? 'unknown';
    const finalizePlan = buildFinalizePlan(commandPlan, draftSlug, organizationId);

    const { error } = await supabase.from('doc_studio_render_command_plans').insert({
      render_job_id: jobId,
      draft_id: manifest.draft_id,
      organization_id: organizationId,
      command_plan_json: commandPlan,
      finalize_plan_json: finalizePlan,
      fingerprint_hash: commandPlan.fingerprintHash,
      scene_count: sceneCommands.length,
      overlay_count: overlayGraph.instructions.length,
      audio_track_count: audioMixPlan.tracks.length,
    });

    if (error) {
      warnings.push(`Failed to persist command plan: ${error.message}`);
    }

    if (subtitlePlan.cues.length === 0) {
      warnings.push('No subtitle cues generated — captions may be missing');
    }

    const assetCount =
      sceneCommands.reduce((n, c) => n + c.segments.length, 0) +
      audioMixPlan.tracks.length +
      overlayGraph.extraInputFiles.length;

    return { success: true, assetCount, warnings };
  }

  async renderProject(
    jobId: string,
    manifest: RenderManifest,
    onProgress: (update: RenderProgressUpdate) => void,
  ): Promise<{ success: boolean; error?: string }> {
    const { data: planRow, error: planErr } = await supabase
      .from('doc_studio_render_command_plans')
      .select('command_plan_json, finalize_plan_json')
      .eq('render_job_id', jobId)
      .maybeSingle();

    if (planErr || !planRow) {
      return { success: false, error: 'Command plan not found — run prepareRenderAssets first' };
    }

    const { data: startResp, error: startErr } = await supabase.functions.invoke(
      FFMPEG_EXECUTOR_FUNCTION,
      {
        body: {
          action: 'start',
          jobId,
          commandPlan: planRow.command_plan_json,
          finalizePlan: planRow.finalize_plan_json,
          renderConfig: manifest.render_config,
          manifest,
        },
      },
    );

    if (startErr || !startResp?.accepted) {
      return {
        success: false,
        error: startErr?.message ?? startResp?.error ?? 'Executor rejected start request',
      };
    }

    onProgress({
      jobId,
      status: 'rendering_timeline',
      progressPercent: 5,
      currentStep: 'FFmpeg render started',
    });

    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
      attempts++;

      const { data: progressResp } = await supabase.functions.invoke(FFMPEG_EXECUTOR_FUNCTION, {
        body: { action: 'progress', jobId },
      });

      if (!progressResp) continue;

      const resp = progressResp as {
        status: string;
        progressPercent: number;
        currentStep: string;
        errorMessage?: string;
      };

      const jobStatus = mapExecutorStatusToJobStatus(resp.status);

      onProgress({
        jobId,
        status: jobStatus,
        progressPercent: resp.progressPercent,
        currentStep: resp.currentStep,
      });

      if (resp.status === 'completed') {
        return { success: true };
      }

      if (resp.status === 'failed' || resp.status === 'cancelled') {
        return { success: false, error: resp.errorMessage ?? `Render ${resp.status}` };
      }
    }

    return { success: false, error: 'Render timed out after maximum poll attempts' };
  }

  async getRenderProgress(jobId: string): Promise<RenderProgressUpdate> {
    const { data } = await supabase.functions.invoke(FFMPEG_EXECUTOR_FUNCTION, {
      body: { action: 'progress', jobId },
    });

    if (!data) {
      return {
        jobId,
        status: 'rendering_timeline',
        progressPercent: 0,
        currentStep: 'Fetching progress…',
      };
    }

    return {
      jobId,
      status: mapExecutorStatusToJobStatus(data.status),
      progressPercent: data.progressPercent ?? 0,
      currentStep: data.currentStep ?? RENDER_JOB_STATUS_LABELS['rendering_timeline'],
    };
  }

  async finalizeRenderOutput(jobId: string, manifest: RenderManifest): Promise<FinalizeResult> {
    const { data: planRow } = await supabase
      .from('doc_studio_render_command_plans')
      .select('finalize_plan_json, command_plan_json')
      .eq('render_job_id', jobId)
      .maybeSingle();

    if (!planRow) {
      return { success: false, error: 'Finalize plan not found' };
    }

    const { data: finalizeResp, error: finalizeErr } = await supabase.functions.invoke(
      FFMPEG_EXECUTOR_FUNCTION,
      {
        body: {
          action: 'finalize',
          jobId,
          finalizePlan: planRow.finalize_plan_json,
          manifest,
        },
      },
    );

    if (finalizeErr || !finalizeResp?.success) {
      return {
        success: false,
        error: finalizeErr?.message ?? finalizeResp?.error ?? 'Finalization failed',
      };
    }

    const now = new Date().toISOString();
    const draftSlug = manifest.draft_title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const artifacts: RenderJobArtifact[] = [
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'rendered_video',
        file_name: `${draftSlug}-${manifest.render_mode}.mp4`,
        file_url: finalizeResp.videoUrl ?? null,
        file_size: finalizeResp.videoSizeBytes ?? null,
        mime_type: 'video/mp4',
        duration_ms: manifest.total_duration_ms,
        width: manifest.render_config.video.width,
        height: manifest.render_config.video.height,
        is_mock: false,
        metadata_json: { render_mode: manifest.render_mode, scene_count: manifest.scene_count },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'render_preview',
        file_name: `${draftSlug}-preview.mp4`,
        file_url: finalizeResp.previewUrl ?? null,
        file_size: finalizeResp.previewSizeBytes ?? null,
        mime_type: 'video/mp4',
        duration_ms: Math.min(manifest.total_duration_ms, 30_000),
        width: 1280,
        height: 720,
        is_mock: false,
        metadata_json: { preview_for: manifest.render_mode },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'render_thumbnail',
        file_name: `${draftSlug}-thumb.jpg`,
        file_url: finalizeResp.thumbnailUrl ?? null,
        file_size: finalizeResp.thumbnailSizeBytes ?? null,
        mime_type: 'image/jpeg',
        duration_ms: null,
        width: manifest.render_config.video.width,
        height: manifest.render_config.video.height,
        is_mock: false,
        metadata_json: { capture_at_ms: 2000 },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'subtitle_srt',
        file_name: `${draftSlug}.srt`,
        file_url: finalizeResp.srtUrl ?? null,
        file_size: finalizeResp.srtSizeBytes ?? null,
        mime_type: 'text/plain',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: false,
        metadata_json: {
          caption_count: manifest.scenes.reduce((n, s) => n + s.captions.length, 0),
        },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'subtitle_vtt',
        file_name: `${draftSlug}.vtt`,
        file_url: finalizeResp.vttUrl ?? null,
        file_size: finalizeResp.vttSizeBytes ?? null,
        mime_type: 'text/vtt',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: false,
        metadata_json: {
          caption_count: manifest.scenes.reduce((n, s) => n + s.captions.length, 0),
        },
        created_at: now,
      },
    ];

    const outputSummary: RenderOutputSummary = {
      engine_provider: 'ffmpeg',
      render_mode: manifest.render_mode,
      total_duration_ms: manifest.total_duration_ms,
      output_resolution: `${manifest.render_config.video.width}x${manifest.render_config.video.height}`,
      fps: manifest.render_config.video.fps,
      file_size_bytes: finalizeResp.videoSizeBytes ?? 0,
      has_subtitles: true,
      has_preview: true,
      has_thumbnail: true,
      artifact_count: artifacts.length,
      completed_at: now,
      is_mock: false,
    };

    return { success: true, outputSummary, artifacts };
  }

  async cancelRender(jobId: string): Promise<{ success: boolean }> {
    const { data, error } = await supabase.functions.invoke(FFMPEG_EXECUTOR_FUNCTION, {
      body: { action: 'cancel', jobId },
    });

    if (error) return { success: false };
    return { success: data?.cancelled ?? false };
  }

  async exportRenderArtifacts(jobId: string): Promise<ExportArtifactsResult> {
    const { data: artifacts, error } = await supabase
      .from('doc_studio_render_job_artifacts')
      .select('artifact_type, file_url, file_name')
      .eq('render_job_id', jobId);

    if (error || !artifacts) {
      return { success: false, error: error?.message ?? 'Failed to fetch artifacts' };
    }

    const downloadUrls: Record<string, string> = {};

    for (const artifact of artifacts) {
      if (!artifact.file_url) continue;

      const storagePath = artifact.file_url.split('/storage/v1/object/public/')[1];
      if (!storagePath) {
        downloadUrls[artifact.artifact_type] = artifact.file_url;
        continue;
      }

      const [bucket, ...pathParts] = storagePath.split('/');
      const objectPath = pathParts.join('/');

      if (!bucket || !objectPath) {
        downloadUrls[artifact.artifact_type] = artifact.file_url;
        continue;
      }

      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 3600);

      if (signed?.signedUrl) {
        downloadUrls[artifact.artifact_type] = signed.signedUrl;
      }
    }

    return { success: true, downloadUrls };
  }
}

function mapExecutorStatusToJobStatus(
  executorStatus: string,
): RenderJob['status'] {
  switch (executorStatus) {
    case 'running':   return 'encoding_video';
    case 'completed': return 'finalizing_assets';
    case 'failed':    return 'failed';
    case 'cancelled': return 'cancelled';
    default:          return 'rendering_timeline';
  }
}

function mapRemotionStatusToJobStatus(
  executorStatus: string,
): RenderJob['status'] {
  switch (executorStatus) {
    case 'rendering': return 'rendering_timeline';
    case 'encoding':  return 'encoding_video';
    case 'muxing':    return 'encoding_video';
    case 'completed': return 'finalizing_assets';
    case 'failed':    return 'failed';
    case 'cancelled': return 'cancelled';
    default:          return 'rendering_timeline';
  }
}

// ─── Remotion Provider ────────────────────────────────────────────────────────

const REMOTION_EXECUTOR_FUNCTION = 'remotion-render-executor';

class RemotionRenderProvider implements IRenderEngineProvider {
  readonly provider: RenderEngineProvider = 'remotion';
  readonly label = 'Remotion';
  readonly available = true;

  async createRenderJob(input: CreateRenderJobInput): Promise<RenderJobResult> {
    const { data, error } = await supabase
      .from('doc_studio_render_jobs')
      .insert({
        draft_id: input.draftId,
        render_project_id: input.renderProjectId,
        organization_id: input.organizationId,
        engine_provider: 'remotion',
        render_mode: input.renderMode,
        status: 'queued',
        progress_percent: 0,
        settings_snapshot_json: input.settingsSnapshot,
        created_by: input.createdBy,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Failed to create render job' };
    }

    return { success: true, jobId: data.id };
  }

  async validateRenderManifest(
    manifest: RenderManifest | null,
  ): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
    if (!manifest) {
      return { valid: false, warnings: [], errors: ['Render manifest is null — run assembly first'] };
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const { video } = manifest.render_config;

    const supportedFps = [24, 25, 30, 60];
    if (!supportedFps.includes(video.fps)) {
      errors.push(`Unsupported fps "${video.fps}" — Remotion supports: ${supportedFps.join(', ')}`);
    }

    const supportedCodecs = ['h264', 'vp9'];
    if (!supportedCodecs.includes(video.codec)) {
      errors.push(`Unsupported codec "${video.codec}" — Remotion supports: ${supportedCodecs.join(', ')}`);
    }

    if (video.width % 2 !== 0 || video.height % 2 !== 0) {
      errors.push(`Resolution ${video.width}x${video.height} must have even dimensions`);
    }

    if (manifest.scene_count === 0) {
      warnings.push('No scenes in manifest — output will be empty');
    }

    if (!manifest.scenes.some(s => s.narration !== null)) {
      warnings.push('No narration audio — video will be silent');
    }

    if (!manifest.scenes.some(s => s.captions.length > 0)) {
      warnings.push('No captions found — consider adding for accessibility');
    }

    for (const scene of manifest.scenes) {
      if (scene.duration_ms <= 0) {
        errors.push(`Scene "${scene.title}" has zero or negative duration`);
      }
      for (const seg of scene.video_segments) {
        if (!seg.source_asset_id) {
          errors.push(`Scene "${scene.title}" has a segment with no source asset`);
        }
      }
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  async prepareRenderAssets(
    jobId: string,
    manifest: RenderManifest,
  ): Promise<{ success: boolean; assetCount: number; warnings: string[] }> {
    const config = manifest.render_config;
    const warnings: string[] = [];

    const baseProps = buildRemotionCompositionProps(manifest);
    const narrationPlan = buildNarrationSyncPlan(manifest);
    const captionPlan = buildCaptionSequences(manifest, config.captions);
    const overlayPlan = buildAllOverlayPlans(manifest, config.callouts);
    const transitions = buildTransitionSequences(manifest, config.transitions);

    warnings.push(...narrationPlan.warnings);

    if (captionPlan.totalCueCount === 0) {
      warnings.push('No subtitle cues generated — captions may be missing');
    }

    const compositionPlan = assembleRemotionCompositionPlan(
      jobId,
      manifest.draft_id,
      manifest.render_project_id ?? '',
      manifest,
      baseProps,
      narrationPlan.tracks,
      captionPlan.cues,
      captionPlan.srtContent,
      captionPlan.vttContent,
      overlayPlan.overlays,
      overlayPlan.callouts,
      overlayPlan.zoomEffects,
      overlayPlan.highlights,
      transitions,
      config,
    );

    const { data: jobRow } = await supabase
      .from('doc_studio_render_jobs')
      .select('organization_id')
      .eq('id', jobId)
      .maybeSingle();

    const organizationId = jobRow?.organization_id ?? 'unknown';
    const draftSlug = manifest.draft_title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const finalizePlan = buildRemotionFinalizePlan(compositionPlan, draftSlug, organizationId);

    const { error } = await supabase.from('doc_studio_remotion_composition_plans').insert({
      render_job_id: jobId,
      draft_id: manifest.draft_id,
      organization_id: organizationId,
      composition_plan_json: compositionPlan,
      finalize_plan_json: finalizePlan,
      fingerprint_hash: compositionPlan.fingerprintHash,
      scene_count: manifest.scene_count,
      overlay_count: overlayPlan.overlayCount,
      audio_track_count: narrationPlan.tracks.length,
    });

    if (error) {
      warnings.push(`Failed to persist composition plan: ${error.message}`);
    }

    const assetCount =
      manifest.scenes.reduce((n, s) => n + s.video_segments.length, 0) +
      narrationPlan.tracks.length +
      overlayPlan.overlayCount;

    return { success: true, assetCount, warnings };
  }

  async renderProject(
    jobId: string,
    manifest: RenderManifest,
    onProgress: (update: RenderProgressUpdate) => void,
  ): Promise<{ success: boolean; error?: string }> {
    const { data: planRow, error: planErr } = await supabase
      .from('doc_studio_remotion_composition_plans')
      .select('composition_plan_json, finalize_plan_json')
      .eq('render_job_id', jobId)
      .maybeSingle();

    if (planErr || !planRow) {
      return { success: false, error: 'Composition plan not found — run prepareRenderAssets first' };
    }

    const { data: startResp, error: startErr } = await supabase.functions.invoke(
      REMOTION_EXECUTOR_FUNCTION,
      {
        body: {
          action: 'start',
          jobId,
          compositionPlan: planRow.composition_plan_json,
          finalizePlan: planRow.finalize_plan_json,
          renderConfig: manifest.render_config,
          manifest,
        },
      },
    );

    if (startErr || !startResp?.accepted) {
      return {
        success: false,
        error: startErr?.message ?? startResp?.error ?? 'Executor rejected start request',
      };
    }

    onProgress({
      jobId,
      status: 'rendering_timeline',
      progressPercent: 5,
      currentStep: 'Remotion render started',
    });

    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
      attempts++;

      const { data: progressResp } = await supabase.functions.invoke(
        REMOTION_EXECUTOR_FUNCTION,
        { body: { action: 'progress', jobId } },
      );

      if (!progressResp) continue;

      const resp = progressResp as RemotionExecutorProgressResponse;
      const jobStatus = mapRemotionStatusToJobStatus(resp.status);

      onProgress({
        jobId,
        status: jobStatus,
        progressPercent: resp.progressPercent ?? 0,
        currentStep: resp.currentStep ?? '',
      });

      if (resp.status === 'completed') {
        return { success: true };
      }

      if (resp.status === 'failed' || resp.status === 'cancelled') {
        return { success: false, error: resp.errorMessage ?? `Render ${resp.status}` };
      }
    }

    return { success: false, error: 'Render timed out after maximum poll attempts' };
  }

  async getRenderProgress(jobId: string): Promise<RenderProgressUpdate> {
    const { data } = await supabase.functions.invoke(REMOTION_EXECUTOR_FUNCTION, {
      body: { action: 'progress', jobId },
    });

    if (!data) {
      return {
        jobId,
        status: 'rendering_timeline',
        progressPercent: 0,
        currentStep: 'Fetching progress…',
      };
    }

    const resp = data as RemotionExecutorProgressResponse;
    return {
      jobId,
      status: mapRemotionStatusToJobStatus(resp.status),
      progressPercent: resp.progressPercent ?? 0,
      currentStep: resp.currentStep ?? RENDER_JOB_STATUS_LABELS['rendering_timeline'],
    };
  }

  async finalizeRenderOutput(jobId: string, manifest: RenderManifest): Promise<FinalizeResult> {
    const { data: planRow } = await supabase
      .from('doc_studio_remotion_composition_plans')
      .select('finalize_plan_json, composition_plan_json')
      .eq('render_job_id', jobId)
      .maybeSingle();

    if (!planRow) {
      return { success: false, error: 'Finalize plan not found' };
    }

    const { data: finalizeResp, error: finalizeErr } = await supabase.functions.invoke(
      REMOTION_EXECUTOR_FUNCTION,
      {
        body: {
          action: 'finalize',
          jobId,
          finalizePlan: planRow.finalize_plan_json,
          manifest,
        },
      },
    );

    if (finalizeErr || !finalizeResp?.success) {
      return {
        success: false,
        error: finalizeErr?.message ?? finalizeResp?.error ?? 'Finalization failed',
      };
    }

    const resp = finalizeResp as RemotionExecutorFinalizeResponse;
    const now = new Date().toISOString();
    const draftSlug = manifest.draft_title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const captionCount = manifest.scenes.reduce((n, s) => n + s.captions.length, 0);

    const artifacts: RenderJobArtifact[] = [
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'rendered_video',
        file_name: `${draftSlug}-${manifest.render_mode}.mp4`,
        file_url: resp.videoUrl ?? null,
        file_size: resp.videoSizeBytes ?? null,
        mime_type: 'video/mp4',
        duration_ms: manifest.total_duration_ms,
        width: manifest.render_config.video.width,
        height: manifest.render_config.video.height,
        is_mock: false,
        metadata_json: { render_mode: manifest.render_mode, scene_count: manifest.scene_count, engine: 'remotion' },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'render_preview',
        file_name: `${draftSlug}-preview.mp4`,
        file_url: resp.previewUrl ?? null,
        file_size: resp.previewSizeBytes ?? null,
        mime_type: 'video/mp4',
        duration_ms: Math.min(manifest.total_duration_ms, 30_000),
        width: 1280,
        height: 720,
        is_mock: false,
        metadata_json: { preview_for: manifest.render_mode, engine: 'remotion' },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'render_thumbnail',
        file_name: `${draftSlug}-thumb.jpg`,
        file_url: resp.thumbnailUrl ?? null,
        file_size: resp.thumbnailSizeBytes ?? null,
        mime_type: 'image/jpeg',
        duration_ms: null,
        width: manifest.render_config.video.width,
        height: manifest.render_config.video.height,
        is_mock: false,
        metadata_json: { capture_at_ms: 2000, engine: 'remotion' },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'subtitle_srt',
        file_name: `${draftSlug}.srt`,
        file_url: resp.srtUrl ?? null,
        file_size: resp.srtSizeBytes ?? null,
        mime_type: 'text/plain',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: false,
        metadata_json: { caption_count: captionCount },
        created_at: now,
      },
      {
        id: '',
        render_job_id: jobId,
        draft_id: manifest.draft_id,
        artifact_type: 'subtitle_vtt',
        file_name: `${draftSlug}.vtt`,
        file_url: resp.vttUrl ?? null,
        file_size: resp.vttSizeBytes ?? null,
        mime_type: 'text/vtt',
        duration_ms: null,
        width: null,
        height: null,
        is_mock: false,
        metadata_json: { caption_count: captionCount },
        created_at: now,
      },
    ];

    const outputSummary: RenderOutputSummary = {
      engine_provider: 'remotion',
      render_mode: manifest.render_mode,
      total_duration_ms: manifest.total_duration_ms,
      output_resolution: `${manifest.render_config.video.width}x${manifest.render_config.video.height}`,
      fps: manifest.render_config.video.fps,
      file_size_bytes: resp.videoSizeBytes ?? 0,
      has_subtitles: true,
      has_preview: true,
      has_thumbnail: true,
      artifact_count: artifacts.length,
      completed_at: now,
      is_mock: false,
    };

    return { success: true, outputSummary, artifacts };
  }

  async cancelRender(jobId: string): Promise<{ success: boolean }> {
    const { data, error } = await supabase.functions.invoke(REMOTION_EXECUTOR_FUNCTION, {
      body: { action: 'cancel', jobId },
    });

    if (error) return { success: false };
    return { success: data?.cancelled ?? false };
  }

  async exportRenderArtifacts(jobId: string): Promise<ExportArtifactsResult> {
    const { data: artifacts, error } = await supabase
      .from('doc_studio_render_job_artifacts')
      .select('artifact_type, file_url, file_name')
      .eq('render_job_id', jobId);

    if (error || !artifacts) {
      return { success: false, error: error?.message ?? 'Failed to fetch artifacts' };
    }

    const downloadUrls: Record<string, string> = {};

    for (const artifact of artifacts) {
      if (!artifact.file_url) continue;

      const storagePath = artifact.file_url.split('/storage/v1/object/public/')[1];
      if (!storagePath) {
        downloadUrls[artifact.artifact_type] = artifact.file_url;
        continue;
      }

      const [bucket, ...pathParts] = storagePath.split('/');
      const objectPath = pathParts.join('/');

      if (!bucket || !objectPath) {
        downloadUrls[artifact.artifact_type] = artifact.file_url;
        continue;
      }

      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 3600);

      if (signed?.signedUrl) {
        downloadUrls[artifact.artifact_type] = signed.signedUrl;
      }
    }

    return { success: true, downloadUrls };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getRenderEngineProvider(engine: RenderEngineProvider): IRenderEngineProvider {
  switch (engine) {
    case 'mock':    return new MockRenderEngineProvider();
    case 'ffmpeg':  return new FfmpegRenderProvider();
    case 'remotion': return new RemotionRenderProvider();
    default:        return new MockRenderEngineProvider();
  }
}

export function formatFileSize(bytes: number): string {
  return formatBytes(bytes);
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  fetchRenderProjects,
  fetchRenderProject,
  createRenderProject,
  updateRenderProjectStatus,
  deleteRenderProject,
  updateRenderConfig,
  persistRenderManifest,
} from '../services/documentation/render/renderProjectService';
import { buildRenderManifest, downloadRenderManifest } from '../services/documentation/render/renderManifestService';
import { buildRenderConfigForMode } from '../services/documentation/render/renderModeService';
import {
  buildTimelineEventsFromManifest,
  persistTimelineEvents,
  fetchTimelineEvents,
} from '../services/documentation/timeline/timelineAssemblyService';
import { logger } from '../lib/logger';
import type { RenderConfig, RenderMode, RenderManifest, PackageExportRecord } from '../types/documentation';

export function useRenderProjects(draftId: string) {
  return useQuery({
    queryKey: ['render_projects', draftId],
    queryFn: () => fetchRenderProjects(draftId),
    staleTime: 60_000,
    enabled: !!draftId,
  });
}

export function useRenderProject(projectId: string | null) {
  return useQuery({
    queryKey: ['render_project', projectId],
    queryFn: () => fetchRenderProject(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCreateRenderProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      draft_id: string;
      organization_id?: string;
      render_mode: RenderMode;
      notes?: string;
    }) => {
      const config = buildRenderConfigForMode(payload.render_mode);
      return createRenderProject({
        ...payload,
        render_config_json: config,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_projects', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRender] useCreateRenderProject failed:', error.message);
    },
  });
}

export function useDeleteRenderProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ project_id }: { project_id: string; draft_id: string }) =>
      deleteRenderProject(project_id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_projects', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRender] useDeleteRenderProject failed:', error.message);
    },
  });
}

export function useUpdateRenderConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ project_id, config }: { project_id: string; draft_id: string; config: RenderConfig }) =>
      updateRenderConfig(project_id, config),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_project', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['render_projects', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRender] useUpdateRenderConfig failed:', error.message);
    },
  });
}

export function useBuildRenderManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      project_id: string;
      draft_id: string;
      draft_title: string;
    }) => {
      const project = await fetchRenderProject(payload.project_id);
      const config = project.render_config_json as RenderConfig;
      const mode = project.render_mode;

      await updateRenderProjectStatus(payload.project_id, 'assembling_assets');

      const manifest = await buildRenderManifest({
        renderProjectId: payload.project_id,
        draftId: payload.draft_id,
        draftTitle: payload.draft_title,
        renderMode: mode,
        renderConfig: config,
      });

      await updateRenderProjectStatus(payload.project_id, 'building_timeline');

      const events = buildTimelineEventsFromManifest(manifest);
      await persistTimelineEvents(payload.project_id, events);

      await persistRenderManifest(
        payload.project_id,
        manifest,
        manifest.total_duration_ms,
        manifest.scene_count
      );

      return manifest;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_project', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['render_projects', vars.draft_id] });
      qc.invalidateQueries({ queryKey: ['render_timeline_events', vars.project_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRender] useBuildRenderManifest failed:', error.message);
    },
  });
}

export function useTimelineEvents(projectId: string | null) {
  return useQuery({
    queryKey: ['render_timeline_events', projectId],
    queryFn: () => fetchTimelineEvents(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useUpdateRenderManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      project_id,
      draft_id: _draft_id,
      manifest,
    }: {
      project_id: string;
      draft_id: string;
      manifest: RenderManifest;
    }) => {
      await persistRenderManifest(
        project_id,
        manifest,
        manifest.total_duration_ms,
        manifest.scene_count,
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['render_project', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['render_projects', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRender] useUpdateRenderManifest failed:', error.message);
    },
  });
}

export function useDownloadRenderManifest() {
  return useMutation({
    mutationFn: async (projectId: string) => {
      const project = await fetchRenderProject(projectId);
      if (!project.render_manifest_json) throw new Error('No manifest built yet');
      downloadRenderManifest(project.render_manifest_json as RenderManifest);
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioRender] useDownloadRenderManifest failed:', error.message);
    },
  });
}

type TimingManifestScene = {
  scene_id?: string;
  start_ms?: number;
  end_ms?: number;
  duration_ms?: number;
};

type TimingManifestLike = {
  total_scenes?: number;
  total_duration_ms?: number;
  scenes?: TimingManifestScene[];
};

type PackageManifestLike = {
  timing_manifest?: TimingManifestLike;
};

function isValidTimingManifestScene(scene: TimingManifestScene): boolean {
  return typeof scene.scene_id === 'string'
    && typeof scene.start_ms === 'number'
    && typeof scene.end_ms === 'number'
    && typeof scene.duration_ms === 'number'
    && scene.start_ms >= 0
    && scene.end_ms > scene.start_ms
    && scene.duration_ms > 0
    && Math.abs((scene.end_ms - scene.start_ms) - scene.duration_ms) <= 5;
}

export function useRenderReadinessCheck(draftId: string) {
  return useQuery({
    queryKey: ['render_readiness', draftId],
    queryFn: async () => {
      const [scenesRes, narrationRes, assetsRes, captionRes, packageRes] = await Promise.all([
        supabase.from('doc_studio_scenes').select('id').eq('draft_id', draftId),
        supabase
          .from('documentation_narration_segments')
          .select('id, scene_id, audio_asset_id, status')
          .eq('draft_id', draftId),
        supabase
          .from('doc_studio_assets')
          .select('id, scene_id, screenshot_role')
          .eq('draft_id', draftId)
          .in('asset_type', ['screenshot']),
        supabase
          .from('doc_studio_caption_manifests')
          .select('id, total_blocks, scene_coverage_pct')
          .eq('draft_id', draftId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('documentation_package_exports')
          .select('manifest_json, package_manifest, scene_count')
          .eq('draft_id', draftId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const scenes = scenesRes.data ?? [];
      const sceneCount = scenes.length;
      const sceneIds = new Set(scenes.map((scene) => scene.id));

      const narrationSegments = narrationRes.data ?? [];
      const readyNarration = narrationSegments.filter((segment) => segment.status === 'ready' && segment.audio_asset_id);
      const narrationSceneCoverage = new Set(
        readyNarration
          .map((segment) => segment.scene_id)
          .filter((sceneId): sceneId is string => typeof sceneId === 'string' && sceneIds.has(sceneId)),
      );

      const screenshotSceneCoverage = new Set(
        (assetsRes.data ?? [])
          .map((asset) => asset.scene_id)
          .filter((sceneId): sceneId is string => typeof sceneId === 'string' && sceneIds.has(sceneId)),
      );

      const hasCaptions = (captionRes.data?.total_blocks ?? 0) > 0;
      const narrationCoverage = sceneCount > 0
        ? Math.round((narrationSceneCoverage.size / sceneCount) * 100)
        : 0;
      const screenshotCoverage = sceneCount > 0
        ? Math.round((screenshotSceneCoverage.size / sceneCount) * 100)
        : 0;
      const captionCoverage = hasCaptions
        ? Math.max(1, Math.round(Number(captionRes.data?.scene_coverage_pct ?? 100)))
        : 0;

      const latestPackage = packageRes.data as Pick<PackageExportRecord, 'manifest_json' | 'package_manifest' | 'scene_count'> | null;
      const packageManifest = (latestPackage?.manifest_json ?? latestPackage?.package_manifest ?? null) as PackageManifestLike | null;
      const timingManifest = packageManifest?.timing_manifest ?? null;
      const timingScenes = Array.isArray(timingManifest?.scenes) ? timingManifest.scenes : [];
      const hasTimingManifest = timingScenes.length > 0;
      const validTimingScenes = timingScenes.filter(isValidTimingManifestScene);
      const timingIntegrityOk = hasTimingManifest
        && validTimingScenes.length === timingScenes.length
        && validTimingScenes.length === sceneCount
        && (timingManifest?.total_scenes == null || timingManifest.total_scenes === sceneCount)
        && timingScenes.every((scene, index) => index === 0 || typeof scene.start_ms !== 'number' || typeof timingScenes[index - 1]?.end_ms !== 'number' || scene.start_ms >= (timingScenes[index - 1]?.end_ms ?? 0))
        && (timingManifest?.total_duration_ms == null || timingManifest.total_duration_ms > 0);

      const warnings: string[] = [];
      if (sceneCount === 0) warnings.push('No scenes found. Add scenes before building a render project.');
      if (narrationCoverage < 80) warnings.push(`Narration audio coverage is low (${narrationCoverage}%). Generate audio for each scene before rendering.`);
      if (screenshotCoverage === 0) warnings.push('No screenshot assets found. Run a capture job first.');
      else if (screenshotCoverage < 50) warnings.push(`Screenshot coverage is low (${screenshotCoverage}%). Capture screenshots for more scenes before rendering.`);
      if (!hasCaptions) warnings.push('No caption manifest found. Build captions in the Assembly tab.');
      if (!hasTimingManifest) warnings.push('No timing manifest found. Run full assembly or package assembly before rendering.');
      else if (!timingIntegrityOk) warnings.push('Timing manifest is present but incomplete or inconsistent with the current scene set. Rebuild the package manifest.');

      const overallReady = sceneCount > 0
        && readyNarration.length > 0
        && hasCaptions
        && hasTimingManifest
        && timingIntegrityOk
        && narrationCoverage >= 80
        && screenshotCoverage >= 50;

      return {
        has_scenes: sceneCount > 0,
        has_narration_audio: readyNarration.length > 0,
        has_captions: hasCaptions,
        has_timing_manifest: hasTimingManifest,
        scene_segmentation_complete: sceneCount > 0 && narrationSegments.length >= sceneCount,
        narration_coverage_pct: narrationCoverage,
        caption_coverage_pct: captionCoverage,
        screenshot_coverage_pct: screenshotCoverage,
        timing_integrity_ok: timingIntegrityOk,
        overall_ready: overallReady,
        warnings,
      };
    },
    enabled: !!draftId,
    staleTime: 120_000,
  });
}

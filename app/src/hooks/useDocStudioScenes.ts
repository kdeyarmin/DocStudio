import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  DocumentationScene,
  DocumentationSceneStep,
  StepExecutionResult,
  TutorialExportPackage,
  CaptionManifest,
} from '../types/documentation';

import { logger } from '../lib/logger';

const SCENES_FN = 'doc-studio-scenes';
const EXPORT_FN = 'doc-studio-export';

async function callScenes<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(SCENES_FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

async function callExport<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(EXPORT_FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export function useDocStudioScenes(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-scenes', draftId],
    queryFn: () =>
      callScenes<{ scenes: DocumentationScene[] }>({ action: 'list', draft_id: draftId }).then(
        (r) => r.scenes
      ),
    enabled: !!draftId,
    staleTime: 30 * 1000,
  });
}

export function useDocStudioScene(sceneId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-scene', sceneId],
    queryFn: () =>
      callScenes<{ scene: DocumentationScene }>({ action: 'get', scene_id: sceneId }).then(
        (r) => r.scene
      ),
    enabled: !!sceneId,
    staleTime: 30 * 1000,
  });
}

export function useCreateScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      job_id?: string | null;
      workflow_id?: string | null;
      scene_order?: number;
      title: string;
      summary?: string | null;
      start_time_seconds?: number;
      end_time_seconds?: number;
      quality_status?: string;
      notes?: string | null;
    }) =>
      callScenes<{ scene: DocumentationScene }>({ action: 'create', ...params }).then(
        (r) => r.scene
      ),
    onSuccess: (scene) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', scene.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useCreateScene failed:', error.message);
    },
  });
}

export function useUpdateScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      scene_id: string;
      draft_id: string;
      title?: string;
      summary?: string | null;
      scene_order?: number;
      start_time_seconds?: number;
      end_time_seconds?: number;
      quality_status?: string;
      notes?: string | null;
      visual_emphasis_json?: Record<string, unknown>;
      metadata_json?: Record<string, unknown>;
    }) =>
      callScenes<{ scene: DocumentationScene }>({ action: 'update', ...params }).then(
        (r) => r.scene
      ),
    onSuccess: (scene, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scene', scene.id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useUpdateScene failed:', error.message);
    },
  });
}

export function useDeleteScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scene_id, draft_id }: { scene_id: string; draft_id: string }) =>
      callScenes<{ deleted: boolean }>({ action: 'delete', scene_id }).then(() => draft_id),
    onSuccess: (draft_id) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useDeleteScene failed:', error.message);
    },
  });
}

export function useReorderScenes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { draft_id: string; ordered_ids: string[] }) =>
      callScenes<{ updated_count: number }>({ action: 'reorder', ...params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useReorderScenes failed:', error.message);
    },
  });
}

export function useBulkCreateScenes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      draft_id: string;
      scenes: Array<{
        title: string;
        summary?: string | null;
        scene_order?: number;
        start_time_seconds?: number;
        end_time_seconds?: number;
        job_id?: string | null;
        workflow_id?: string | null;
      }>;
    }) =>
      callScenes<{ scenes: DocumentationScene[]; count: number }>({
        action: 'bulk_create',
        draft_id: params.draft_id,
        scenes: params.scenes,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useBulkCreateScenes failed:', error.message);
    },
  });
}

export function useLinkSceneStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      scene_id: string;
      draft_id: string;
      workflow_step_id: string | null;
      step_order: number;
      step_result_json?: StepExecutionResult | Record<string, unknown>;
    }) =>
      callScenes<{ scene_step: DocumentationSceneStep }>({
        action: 'link_step',
        scene_id: params.scene_id,
        workflow_step_id: params.workflow_step_id,
        step_order: params.step_order,
        step_result_json: params.step_result_json ?? {},
      }).then((r) => r.scene_step),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scene', vars.scene_id] });
      qc.invalidateQueries({ queryKey: ['doc-studio-scenes', vars.draft_id] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useLinkSceneStep failed:', error.message);
    },
  });
}

export function useBuildExportPackage() {
  return useMutation({
    mutationFn: (draft_id: string) =>
      callExport<{ success: boolean; package: TutorialExportPackage }>({
        action: 'build_package',
        draft_id,
      }).then((r) => r.package),
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useBuildExportPackage failed:', error.message);
    },
  });
}

export function useExportSRT() {
  return useMutation({
    mutationFn: (draft_id: string) =>
      callExport<{ success: boolean; srt: string; caption_manifest: CaptionManifest }>({
        action: 'export_srt',
        draft_id,
      }),
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useExportSRT failed:', error.message);
    },
  });
}

export function useExportGuideMarkdown() {
  return useMutation({
    mutationFn: (draft_id: string) =>
      callExport<{ success: boolean; markdown: string; filename: string; title: string }>({
        action: 'export_guide_md',
        draft_id,
      }),
    onError: (error: Error) => {
      logger.error('[useDocStudioScenes] useExportGuideMarkdown failed:', error.message);
    },
  });
}

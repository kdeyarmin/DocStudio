import type { RenderManifest as BaseRenderManifest } from '../../types/documentation';

export interface SceneRow {
  id: string;
  scene_order: number | null;
  title: string | null;
  summary: string | null;
  narration_text: string | null;
  start_time_seconds: number | null;
  end_time_seconds: number | null;
}

export interface NarrationAsset {
  id: string;
  public_url: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown> | null;
}

export type RenderManifest = BaseRenderManifest;

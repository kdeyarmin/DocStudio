import { supabase } from './supabase';
import type {
  DocumentationShotPlan,
  ShotType,
  ShotPurpose,
  ShotSourceType,
  CameraMode,
  CropMode,
  CalloutStyle,
  PointerStyle,
  ShotEmphasisLevel,
  ShotPacingMode,
  ShotTransition,
  OverlayPosition,
  BoundingRegion,
  PointerPathPoint,
} from '../types/documentation';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchShotPlansForDraft(draftId: string): Promise<DocumentationShotPlan[]> {
  const { data, error } = await supabase
    .from('doc_studio_shot_plans')
    .select('*')
    .eq('draft_id', draftId)
    .order('shot_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentationShotPlan[];
}

export async function fetchShotPlansForScene(
  draftId: string,
  sceneId: string,
): Promise<DocumentationShotPlan[]> {
  const { data, error } = await supabase
    .from('doc_studio_shot_plans')
    .select('*')
    .eq('draft_id', draftId)
    .eq('scene_id', sceneId)
    .order('shot_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentationShotPlan[];
}

export async function countShotPlansForDraft(draftId: string): Promise<number> {
  const { count, error } = await supabase
    .from('doc_studio_shot_plans')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', draftId);
  if (error) throw error;
  return count ?? 0;
}

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateShotPlanPayload {
  draft_id: string;
  scene_id?: string | null;
  shot_order?: number;
  title: string;
  shot_type?: ShotType;
  purpose?: ShotPurpose;
  source_type?: ShotSourceType;
  source_asset_id?: string | null;
  start_time_seconds?: number;
  end_time_seconds?: number;
  camera_mode?: CameraMode;
  crop_mode?: CropMode;
  zoom_region_json?: BoundingRegion | null;
  highlight_region_json?: BoundingRegion | null;
  callout_title?: string | null;
  callout_description?: string | null;
  callout_style?: CalloutStyle;
  callout_start_time?: number | null;
  callout_end_time?: number | null;
  pointer_style?: PointerStyle;
  pointer_path_json?: PointerPathPoint[] | null;
  overlay_asset_id?: string | null;
  overlay_position?: OverlayPosition;
  overlay_start_time?: number | null;
  overlay_end_time?: number | null;
  emphasis_level?: ShotEmphasisLevel;
  pacing_mode?: ShotPacingMode;
  transition_in?: ShotTransition;
  transition_out?: ShotTransition;
  transition_duration?: number;
  is_key_shot?: boolean;
  notes?: string | null;
  metadata_json?: Record<string, unknown>;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export type UpdateShotPlanPayload = Partial<Omit<CreateShotPlanPayload, 'draft_id'>>;

export async function updateShotPlan(
  shotPlanId: string,
  updates: UpdateShotPlanPayload,
): Promise<DocumentationShotPlan> {
  const allowed: (keyof UpdateShotPlanPayload)[] = [
    'scene_id', 'shot_order', 'title', 'shot_type', 'purpose', 'source_type',
    'source_asset_id', 'start_time_seconds', 'end_time_seconds', 'camera_mode',
    'crop_mode', 'zoom_region_json', 'highlight_region_json', 'callout_title',
    'callout_description', 'callout_style', 'callout_start_time', 'callout_end_time',
    'pointer_style', 'pointer_path_json', 'overlay_asset_id', 'overlay_position',
    'overlay_start_time', 'overlay_end_time', 'emphasis_level', 'pacing_mode',
    'transition_in', 'transition_out', 'transition_duration', 'is_key_shot', 'notes',
    'metadata_json',
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }
  const { data, error } = await supabase
    .from('doc_studio_shot_plans')
    .update(patch)
    .eq('id', shotPlanId)
    .select()
    .single();
  if (error) throw error;
  return data as DocumentationShotPlan;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteShotPlan(shotPlanId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_studio_shot_plans')
    .delete()
    .eq('id', shotPlanId);
  if (error) throw error;
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

export async function reorderShotPlans(
  updates: Array<{ id: string; shot_order: number }>,
  orgId: string,
): Promise<void> {
  if (!updates.length) return;
  await Promise.all(
    updates.map(({ id, shot_order }) =>
      supabase.from('doc_studio_shot_plans').update({ shot_order }).eq('id', id).eq('organization_id', orgId),
    ),
  );
}

// ─── Key Shot Helpers ─────────────────────────────────────────────────────────

export async function fetchKeyShots(draftId: string): Promise<DocumentationShotPlan[]> {
  const { data, error } = await supabase
    .from('doc_studio_shot_plans')
    .select('*')
    .eq('draft_id', draftId)
    .eq('is_key_shot', true)
    .order('shot_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentationShotPlan[];
}

export async function toggleKeyShotFlag(
  shotPlanId: string,
  isKeyShot: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('doc_studio_shot_plans')
    .update({ is_key_shot: isKeyShot })
    .eq('id', shotPlanId);
  if (error) throw error;
}

// ─── Summary Helpers ──────────────────────────────────────────────────────────

interface ShotPlanSummary {
  total: number;
  key_shot_count: number;
  scenes_with_shots: Set<string>;
  by_type: Partial<Record<ShotType, number>>;
  by_emphasis: Partial<Record<ShotEmphasisLevel, number>>;
  avg_duration_seconds: number;
}

export function buildShotPlanSummary(plans: DocumentationShotPlan[]): ShotPlanSummary {
  const summary: ShotPlanSummary = {
    total: plans.length,
    key_shot_count: 0,
    scenes_with_shots: new Set(),
    by_type: {},
    by_emphasis: {},
    avg_duration_seconds: 0,
  };
  let totalDuration = 0;
  for (const plan of plans) {
    if (plan.is_key_shot) summary.key_shot_count++;
    if (plan.scene_id) summary.scenes_with_shots.add(plan.scene_id);
    summary.by_type[plan.shot_type] = (summary.by_type[plan.shot_type] ?? 0) + 1;
    summary.by_emphasis[plan.emphasis_level] = (summary.by_emphasis[plan.emphasis_level] ?? 0) + 1;
    totalDuration += plan.end_time_seconds - plan.start_time_seconds;
  }
  summary.avg_duration_seconds = plans.length > 0 ? totalDuration / plans.length : 0;
  return summary;
}

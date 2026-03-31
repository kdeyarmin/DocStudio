import { supabase } from '../../../lib/supabase';
import type {
  RenderProject,
  RenderProjectStatus,
  RenderMode,
  RenderConfig,
} from '../../../types/documentation';

export async function fetchRenderProjects(draftId: string): Promise<RenderProject[]> {
  const { data, error } = await supabase
    .from('doc_studio_render_projects')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RenderProject[];
}

export async function fetchRenderProject(projectId: string, organizationId?: string): Promise<RenderProject> {
  let query = supabase
    .from('doc_studio_render_projects')
    .select('*')
    .eq('id', projectId);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Render project not found');
  return data as RenderProject;
}

export async function createRenderProject(payload: {
  draft_id: string;
  organization_id?: string;
  render_mode: RenderMode;
  render_config_json: RenderConfig;
  notes?: string;
}): Promise<RenderProject> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  const { organization_id: _org, ...rest } = payload;
  const { data, error } = await supabase
    .from('doc_studio_render_projects')
    .insert({
      ...rest,
      render_status: 'not_started',
      assembled_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Failed to create render project: no data returned');
  return data as RenderProject;
}

export async function updateRenderProjectStatus(
  projectId: string,
  status: RenderProjectStatus,
  extra?: Partial<Pick<RenderProject, 'error_message' | 'total_duration_ms' | 'scene_count' | 'render_manifest_json' | 'render_warnings_json'>>,
  organizationId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { render_status: status, ...extra };
  if (status === 'rendering') patch.render_started_at = now;
  if (status === 'rendered') patch.render_completed_at = now;

  let query = supabase
    .from('doc_studio_render_projects')
    .update(patch)
    .eq('id', projectId);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteRenderProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_studio_render_projects')
    .delete()
    .eq('id', projectId);
  if (error) throw error;
}

export async function updateRenderConfig(
  projectId: string,
  config: RenderConfig,
  organizationId?: string
): Promise<void> {
  let query = supabase
    .from('doc_studio_render_projects')
    .update({ render_config_json: config })
    .eq('id', projectId);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { error } = await query;
  if (error) throw error;
}

export async function persistRenderManifest(
  projectId: string,
  manifestJson: unknown,
  totalDurationMs: number,
  sceneCount: number,
  organizationId?: string
): Promise<void> {
  let query = supabase
    .from('doc_studio_render_projects')
    .update({
      render_manifest_json: manifestJson,
      total_duration_ms: totalDurationMs,
      scene_count: sceneCount,
      render_status: 'ready_to_render',
      assembled_at: new Date().toISOString(),
    })
    .eq('id', projectId);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { error } = await query;
  if (error) throw error;
}

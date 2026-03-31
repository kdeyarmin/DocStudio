import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { getContentProvider } from '../providers/content/ContentProviderFactory';
import { getNarrationProvider } from '../providers/narration/NarrationProviderFactory';
import { computeChecklistFromDraft, computeScore } from '../components/doc-studio/completeness-utils';
import { escapeFilterValue } from '../lib/sanitize';
import { readStorageJson } from '../lib/storage';
import type {
  DocStudioDraft,
  DraftListItem,
  DocStudioAsset,
  DraftStatus,
  OutputType,
  ProviderMode,
  TargetRole,
  AssetType,
  ReviewDecision,
  EditedContent,
} from '../types/doc-studio';

const STORAGE_BUCKET = 'doc-studio-assets';
const EDITED_CONTENT_KEYS = ['guide_md', 'transcript', 'narration_script'] as const;

function isEditedContent(value: unknown): value is EditedContent {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !EDITED_CONTENT_KEYS.includes(key as (typeof EDITED_CONTENT_KEYS)[number]))) {
    return false;
  }
  return EDITED_CONTENT_KEYS.every((key) => record[key] === undefined || typeof record[key] === 'string');
}

function sanitizeEditedContent(value: EditedContent): EditedContent {
  const sanitized: EditedContent = {};
  EDITED_CONTENT_KEYS.forEach((key) => {
    const field = value[key];
    if (typeof field === 'string') {
      sanitized[key] = field;
    }
  });
  return sanitized;
}

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) throw new Error('Not authenticated');
  return data.user.id;
}

export function useDocStudioDrafts(opts?: {
  organizationId?: string;
  status?: DraftStatus | 'all';
  search?: string;
  isSuperAdmin?: boolean;
}) {
  const normalizedOpts = opts
    ? {
        ...opts,
        // Normalize search so that leading/trailing whitespace does not affect caching or querying
        search: opts.search?.trim() || undefined,
      }
    : undefined;

  return useQuery({
    queryKey: ['doc-studio-drafts', normalizedOpts],
    queryFn: async () => {
      let query = supabase
        .from('doc_studio_drafts')
        .select('id, title, description, output_type, status, version_label, target_role, completeness_score, assembly_status, integrity_status, integrity_score, revalidation_required, package_version, last_assembled_at, review_stage, created_by, created_at, updated_at, steps')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (normalizedOpts?.organizationId) {
        query = query.eq('organization_id', normalizedOpts.organizationId);
      } else if (!normalizedOpts?.isSuperAdmin) {
        query = query.eq('organization_id', '');
      }

      const status = normalizedOpts?.status ?? 'all';
      if (status && status !== 'all') query = query.eq('status', status);

      const search = normalizedOpts?.search ?? '';
      if (search) {
        const escapedSearch = escapeFilterValue(search);
        query = query.or(`title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        review_workflow_stage: (d.review_stage as string) ?? null,
      })) as DraftListItem[];
    },
    enabled: !!(normalizedOpts?.organizationId || normalizedOpts?.isSuperAdmin),
    staleTime: 2 * 60 * 1000,
  });
}

export function useDocStudioDraft(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-draft', draftId],
    queryFn: async () => {
      const { data: draft, error: draftErr } = await supabase
        .from('doc_studio_drafts')
        .select('*')
        .eq('id', draftId!)
        .maybeSingle();
      if (draftErr) throw new Error(draftErr.message);
      if (!draft) throw new Error('Draft not found');

      const { data: assets } = await supabase
        .from('doc_studio_assets')
        .select('*')
        .eq('draft_id', draftId!)
        .order('sort_order', { ascending: true });

      const { data: reviews } = await supabase
        .from('doc_studio_reviews')
        .select('*')
        .eq('draft_id', draftId!)
        .order('created_at', { ascending: false });

      return {
        ...draft,
        assets: assets ?? [],
        reviews: reviews ?? [],
      } as DocStudioDraft;
    },
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      title: string;
      description?: string;
      targetUrl?: string;
      outputType?: OutputType;
      providerMode?: ProviderMode;
      targetRole?: TargetRole;
    }) => {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('doc_studio_drafts')
        .insert({
          organization_id: params.organizationId,
          created_by: userId,
          title: params.title,
          description: params.description ?? '',
          target_url: params.targetUrl ?? '',
          output_type: params.outputType ?? 'screenshot_guide',
          provider_mode: params.providerMode ?? 'mock',
          target_role: params.targetRole ?? 'staff',
          status: 'draft',
          steps: [],
          generated_content: {},
          edited_content: {},
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DocStudioDraft;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('useCreateDraft failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      title?: string;
      description?: string;
      targetUrl?: string;
      versionLabel?: string;
      targetRole?: TargetRole;
      steps?: DocStudioDraft['steps'];
      generatedContent?: DocStudioDraft['generated_content'];
      editedContent?: EditedContent;
      publishNotes?: string;
      status?: DraftStatus;
      completenessScore?: number;
    }) => {
      const updates: Record<string, unknown> = {};
      if (params.title !== undefined) updates.title = params.title;
      if (params.description !== undefined) updates.description = params.description;
      if (params.targetUrl !== undefined) updates.target_url = params.targetUrl;
      if (params.versionLabel !== undefined) updates.version_label = params.versionLabel;
      if (params.targetRole !== undefined) updates.target_role = params.targetRole;
      if (params.steps !== undefined) updates.steps = params.steps;
      if (params.generatedContent !== undefined) updates.generated_content = params.generatedContent;
      if (params.editedContent !== undefined) updates.edited_content = params.editedContent;
      if (params.publishNotes !== undefined) updates.publish_notes = params.publishNotes;
      if (params.status !== undefined) updates.status = params.status;
      if (params.completenessScore !== undefined) updates.completeness_score = params.completenessScore;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('doc_studio_drafts')
        .update(updates)
        .eq('id', params.draftId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DocStudioDraft;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('useUpdateDraft failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draftId, organizationId }: { draftId: string; organizationId: string }) => {
      const { error } = await supabase
        .from('doc_studio_drafts')
        .delete()
        .eq('id', draftId)
        .eq('organization_id', organizationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('useDeleteDraft failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      decision: ReviewDecision;
      notes?: string;
      organizationId: string;
    }) => {
      const userId = await getCurrentUserId();

      const { data: draft, error: fetchErr } = await supabase
        .from('doc_studio_drafts')
        .select('*, doc_studio_assets(*)')
        .eq('id', params.draftId)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!draft) throw new Error('Draft not found');

      const draftWithAssets: Partial<DocStudioDraft> = { ...draft, assets: draft.doc_studio_assets ?? [] };
      const checklist = computeChecklistFromDraft(draftWithAssets);
      const score = computeScore(checklist);

      const { data: review, error: reviewErr } = await supabase
        .from('doc_studio_reviews')
        .insert({
          draft_id: params.draftId,
          organization_id: params.organizationId,
          reviewer_id: userId,
          decision: params.decision,
          notes: params.notes ?? '',
          completeness_score: score,
          checklist_json: checklist,
        })
        .select()
        .single();
      if (reviewErr) throw new Error(reviewErr.message);

      let newStatus: DraftStatus = draft.status;
      if (params.decision === 'approved') newStatus = 'approved';
      else if (params.decision === 'changes_requested') newStatus = 'draft';

      const { error: statusErr } = await supabase
        .from('doc_studio_drafts')
        .update({
          status: newStatus,
          completeness_score: score,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.draftId)
        .eq('organization_id', params.organizationId);
      if (statusErr) throw new Error(statusErr.message);

      return { review, completenessScore: score, checklist };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('useSubmitReview failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function usePublishDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { draftId: string; organizationId: string; publishNotes?: string }) => {
      const userId = await getCurrentUserId();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('doc_studio_drafts')
        .update({
          status: 'published' as DraftStatus,
          published_at: now,
          reviewed_by: userId,
          reviewed_at: now,
          publish_notes: params.publishNotes ?? '',
          updated_at: now,
        })
        .eq('id', params.draftId)
        .eq('organization_id', params.organizationId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DocStudioDraft;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('usePublishDraft failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useArchiveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draftId, organizationId }: { draftId: string; organizationId: string }) => {
      const { data, error } = await supabase
        .from('doc_studio_drafts')
        .update({
          status: 'archived' as DraftStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .eq('organization_id', organizationId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DocStudioDraft;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
    },
    onError: (error: Error) => {
      logger.error('useArchiveDraft failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useUploadAsset(draftId: string, organizationId: string) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async (file: File, opts?: {
    assetType?: AssetType;
    stepIndex?: number;
    sortOrder?: number;
  }) => {
    setIsUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${organizationId}/${draftId}/${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;

      setProgress(20);
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      setProgress(70);
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      const { data, error } = await supabase
        .from('doc_studio_assets')
        .insert({
          draft_id: draftId,
          organization_id: organizationId,
          storage_path: path,
          public_url: urlData.publicUrl,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          asset_type: opts?.assetType ?? 'screenshot',
          step_index: opts?.stepIndex ?? null,
          sort_order: opts?.sortOrder ?? 0,
          metadata: {},
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      setProgress(100);
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-drafts'] });
      return data as DocStudioAsset;
    } finally {
      setIsUploading(false);
    }
  }, [draftId, organizationId, qc]);

  return { upload, progress, isUploading };
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, draftId, organizationId }: { assetId: string; draftId: string; organizationId: string }) => {
      const { data: asset, error: fetchErr } = await supabase
        .from('doc_studio_assets')
        .select('storage_path')
        .eq('id', assetId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);

      if (asset?.storage_path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([asset.storage_path]);
      }

      const { error } = await supabase
        .from('doc_studio_assets')
        .delete()
        .eq('id', assetId)
        .eq('organization_id', organizationId);
      if (error) throw new Error(error.message);

      return draftId;
    },
    onSuccess: (draftId) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
    },
    onError: (error: Error) => {
      logger.error('useDeleteAsset failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useAutosaveDraft(draftId: string | null) {
  const updateDraft = useUpdateDraft();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const scheduleSave = useCallback((editedContent: EditedContent) => {
    setSaveState('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!draftId) return;

    const key = `doc-studio-draft-backup-${draftId}`;
    try { sessionStorage.setItem(key, JSON.stringify(editedContent)); } catch { /* ignore */ }

    timerRef.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        await updateDraft.mutateAsync({ draftId, editedContent });
        setSaveState('saved');
        try { sessionStorage.removeItem(key); } catch { /* ignore */ }
      } catch (err) {
        logger.error('Doc studio auto-save failed:', err instanceof Error ? err : new Error(String(err)));
        setSaveState('unsaved');
      }
    }, 500);
  }, [draftId, updateDraft]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const getBackup = useCallback(() => {
    if (!draftId) return null;
    const backup = readStorageJson<EditedContent | null>(
      sessionStorage,
      `doc-studio-draft-backup-${draftId}`,
      {
        fallback: null,
        storageName: 'sessionStorage',
        clearInvalid: true,
        validate: (value): value is EditedContent => isEditedContent(value),
      }
    );
    if (!backup) return null;
    return sanitizeEditedContent(backup);
  }, [draftId]);

  return { scheduleSave, saveState, getBackup };
}

export function useGenerateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      jobId: string;
      draftId: string;
      organizationId: string;
    }) => {
      const provider = getContentProvider();
      return provider.generateContent(params);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', vars.draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-job', vars.jobId] });
    },
    onError: (error: Error) => {
      logger.error('useGenerateContent failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useGenerateNarration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      organizationId: string;
      voiceId?: string;
    }) => {
      const provider = getNarrationProvider();
      return provider.generateNarration(params);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', vars.draftId] });
    },
    onError: (error: Error) => {
      logger.error('useGenerateNarration failed:', error instanceof Error ? error : new Error(String(error)));
    },
  });
}

export function useElevenLabsAvailable() {
  return useQuery({
    queryKey: ['doc-studio-elevenlabs-available'],
    queryFn: async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.id) return false;
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (profileErr || !profile?.organization_id) return false;
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        available: boolean;
      }>('doc-studio-narration', {
        body: { action: 'check_available', organization_id: profile.organization_id },
      });
      if (error) return false;
      return data?.available ?? false;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

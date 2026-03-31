import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, Eye, SendHorizontal as SendHorizonal, Globe, Archive, Trash2, MoveHorizontal as MoreHorizontal, PanelRightOpen, PanelRightClose, FileText, Video, Mic, ChevronDown, ChevronRight, CircleAlert as AlertCircle, Loader as Loader2, ExternalLink, Film, BookOpen, BookMarked, Captions, Sparkles } from 'lucide-react';
import {
  useDocStudioDraft,
  useUpdateDraft,
  useDeleteDraft,
  useArchiveDraft,
  usePublishDraft,
  useSubmitReview,
  useAutosaveDraft,
} from '../../hooks/useDocStudio';
import { DraftStatusBadge } from './DraftStatusBadge';
import { CompletenessIndicator } from './CompletenessIndicator';
import { EditorTab } from './EditorTab';
import { GeneratedTab } from './GeneratedTab';
import { TranscriptTab } from './TranscriptTab';
import { DiffViewer } from './DiffViewer';
import { AssetsPanel } from './AssetsPanel';
import { ScenesTab } from './tabs/ScenesTab';
import { NarrationTab } from './tabs/NarrationTab';
import { QualityTab } from './tabs/QualityTab';
import { DriftTab } from './tabs/DriftTab';
import { VariantsTab } from './tabs/VariantsTab';
import { CaptionsTab } from './tabs/CaptionsTab';
import { ExportTab } from './tabs/ExportTab';
import { PronunciationTab } from './tabs/PronunciationTab';
import { AssemblyTab } from './tabs/AssemblyTab';
import { TimingTab } from './tabs/TimingTab';
import { AudioTab } from './tabs/AudioTab';
import { PackageManifestTab } from './tabs/PackageManifestTab';
import { RenderTab } from './tabs/RenderTab';
import { ShotPlansTab } from './tabs/ShotPlansTab';
import { IntegrityTab } from './tabs/IntegrityTab';
import { RevalidationTab } from './tabs/RevalidationTab';
import { ReviewTab } from './review/ReviewTab';
import { PublishConfirmModal } from './PublishConfirmModal';
import { ReviewSubmitModal } from './ReviewSubmitModal';
import { GenerateFinishedTutorialModal } from './GenerateFinishedTutorialModal';
import { useToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';
import { useLatestPackage } from '../../hooks/useDocStudioPackage';
import { useLatestRenderJob, useRenderJobsForDraft } from '../../hooks/useDocStudioRenderJobs';
import { isSafeExternalUrl } from '../../lib/browser';
import {
  ACTIVE_RENDER_STATUSES,
  RENDER_JOB_STATUS_COLORS,
  RENDER_JOB_STATUS_LABELS,
} from '../../types/documentation';
import type {
  DocStudioStep, EditedContent, OutputType, TargetRole, ReviewDecision,
} from '../../types/doc-studio';
import type { TutorialPackageManifest, RenderJob, RenderMode, RenderOutputSummary, AssemblyStatus } from '../../types/documentation';

type Tab = 'editor' | 'generated' | 'diff' | 'transcript' | 'scenes' | 'narration' | 'captions' | 'pronunciation' | 'quality' | 'drift' | 'variants' | 'export' | 'assembly' | 'timing' | 'audio' | 'package_manifest' | 'render' | 'shot_plans' | 'integrity' | 'revalidation' | 'review';

const OUTPUT_TYPE_ICONS: Record<OutputType, React.ElementType> = {
  screenshot_guide: FileText,
  video_tutorial: Video,
  narrated_video: Mic,
};

const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  screenshot_guide: 'Screenshot Guide',
  video_tutorial: 'Video Tutorial',
  narrated_video: 'Narrated Video',
};

const ROLE_LABELS: Record<TargetRole, string> = {
  admin: 'Admin',
  provider: 'Provider',
  staff: 'Staff',
  patient: 'Patient',
};

function SkeletonDetail() {
  return (
    <div className="flex h-full overflow-hidden animate-pulse">
      <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white p-4 space-y-4">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-16 bg-slate-100 rounded" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-slate-200 bg-white" />
        <div className="flex-1 bg-slate-50" />
      </div>
    </div>
  );
}

interface MetadataFieldProps {
  label: string;
  children: React.ReactNode;
}
function MetaField({ label, children }: MetadataFieldProps) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

interface StepListProps {
  steps: DocStudioStep[];
  draftId: string;
  draftTitle: string;
  draftDescription?: string;
  organizationId: string;
  onStepsGenerated?: () => void;
}
function StepList({ steps, draftId, draftTitle, draftDescription, organizationId, onStepsGenerated }: StepListProps) {
  const [open, setOpen] = useState(steps.length === 0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const updateDraft = useUpdateDraft();
  const { showToast } = useToast();

  async function handleGenerateSteps() {
    setGenerating(true);
    setGenError(null);
    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.refreshSession();
      if (sessionErr || !session?.access_token) {
        throw new Error('Session expired. Please refresh the page and try again.');
      }

      const prompt = [
        `Generate a concise list of 5-8 tutorial steps for a training document titled "${draftTitle}".`,
        draftDescription ? `Description: ${draftDescription}` : '',
        'Return ONLY a JSON array with objects: { "index": number, "title": string, "description": string }.',
        'Steps should be practical, actionable, and focused on teaching users how to use the feature.',
        'Keep each title under 8 words. Keep each description under 25 words.',
      ].filter(Boolean).join('\n');

      const { data: result, error: fnErr } = await supabase.functions.invoke('claude-api-proxy', {
        body: {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
          organizationId,
        },
      });

      if (fnErr) throw new Error(fnErr.message ?? 'AI request failed');
      const text = typeof result?.text === 'string'
        ? result.text
        : typeof result?.content === 'string'
        ? result.content
        : '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      const rawSteps: Array<{ index?: number; title?: string; description?: string }> = JSON.parse(jsonMatch[0]);
      const steps: DocStudioStep[] = rawSteps.map((s, i) => ({
        index: s.index ?? i + 1,
        title: s.title ?? `Step ${i + 1}`,
        description: s.description ?? '',
      }));

      await updateDraft.mutateAsync({ draftId, steps });
      showToast(`Generated ${steps.length} steps`, 'success');
      onStepsGenerated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate steps';
      setGenError(msg);
      showToast(msg, 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Steps ({steps.length})
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && steps.length > 0 && (
        <div className="divide-y divide-slate-100">
          {steps.map((step) => (
            <div key={step.index} className="px-3 py-2">
              <p className="text-xs font-medium text-slate-700 leading-snug">{step.title}</p>
              {step.description && (
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{step.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {open && steps.length === 0 && (
        <div className="px-3 py-3 space-y-2">
          <p className="text-xs text-slate-400 italic">No steps defined</p>
          {genError && (
            <p className="text-xs text-red-500">{genError}</p>
          )}
          <button
            onClick={handleGenerateSteps}
            disabled={generating}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {generating ? 'Generating steps…' : 'Generate steps with AI'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Final Output Mini Summary ────────────────────────────────────────────────

const RENDER_MODES_ORDERED: RenderMode[] = ['quick_preview', 'standard_training', 'detailed_walkthrough'];

const MODE_ROW_ICONS: Record<RenderMode, React.ReactNode> = {
  quick_preview: <Film size={11} className="text-slate-500" />,
  standard_training: <BookOpen size={11} className="text-blue-600" />,
  detailed_walkthrough: <BookMarked size={11} className="text-blue-600" />,
};

const MODE_ROW_SHORT_LABELS: Record<RenderMode, string> = {
  quick_preview: 'Preview',
  standard_training: 'Training',
  detailed_walkthrough: 'Walkthrough',
};

function FinalOutputMiniSummary({ jobs, onClick }: { jobs: RenderJob[]; onClick: () => void }) {
  const jobByMode = new Map<RenderMode, RenderJob>();
  jobs.forEach(job => {
    const existing = jobByMode.get(job.render_mode);
    if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
      jobByMode.set(job.render_mode, job);
    }
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label="Open render outputs"
      className="w-full rounded-lg border border-slate-200 overflow-hidden text-left cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {RENDER_MODES_ORDERED.map((mode, idx) => {
        const job = jobByMode.get(mode);
        const summary = job?.output_summary_json as RenderOutputSummary | null;
        const isActive = job ? ACTIVE_RENDER_STATUSES.includes(job.status) : false;
        return (
          <div
            key={mode}
            className={`flex items-center gap-2 px-2.5 py-1.5 ${idx < 2 ? 'border-b border-slate-100' : ''}`}
          >
            {MODE_ROW_ICONS[mode]}
            <span className="text-[11px] text-slate-700 font-medium flex-1 truncate">
              {MODE_ROW_SHORT_LABELS[mode]}
            </span>
            {job ? (
              <div className="flex items-center gap-1.5">
                {summary?.has_subtitles && (
                  <span title="Subtitles available" aria-label="Subtitles available">
                    <Captions size={9} className="text-blue-500" />
                  </span>
                )}
                {isActive ? (
                  <div className="flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin text-blue-500" />
                    <span className="text-[10px] text-blue-600 tabular-nums">{job.progress_percent ?? 0}%</span>
                  </div>
                ) : (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${RENDER_JOB_STATUS_COLORS[job.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {RENDER_JOB_STATUS_LABELS[job.status] ?? job.status}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-slate-300">—</span>
            )}
          </div>
        );
      })}
    </button>
  );
}

interface Props {
  draftId: string | null;
  organizationId: string;
  onBack: () => void;
}

export function DocStudioDraftDetail({ draftId, organizationId, onBack }: Props) {
  const { showToast } = useToast();
  const { data: draft, isLoading, error, refetch } = useDocStudioDraft(draftId);
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const archiveDraft = useArchiveDraft();
  const publishDraft = usePublishDraft();
  const submitReview = useSubmitReview();
  const { data: latestPackage } = useLatestPackage(draftId);
  const packageManifest = (latestPackage?.manifest_json as TutorialPackageManifest | null) ?? null;

  const { data: latestRenderJob } = useLatestRenderJob(draftId);
  const { data: allRenderJobs = [] } = useRenderJobsForDraft(draftId);

  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [showAssets, setShowAssets] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editedContent, setEditedContent] = useState<EditedContent>({});
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const { scheduleSave, saveState, getBackup } = useAutosaveDraft(draftId);

  const handleNavigateToTab = (tab: string) => setActiveTab(tab as Tab);

  useEffect(() => {
    if (!draft) return;
    const backup = getBackup();
    setEditedContent(backup ?? draft.edited_content ?? {});
    setTitleValue(draft.title ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  const handleContentChange = (content: EditedContent) => {
    setEditedContent(content);
    scheduleSave(content);
  };

  const handleSaveNow = async () => {
    if (!draftId) return;
    try {
      await updateDraft.mutateAsync({ draftId, editedContent });
      showToast('Saved', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Save failed'), 'error');
    }
  };

  const handleTitleSave = async () => {
    if (!draftId || !titleValue.trim()) { setTitleEditing(false); return; }
    setTitleEditing(false);
    try {
      await updateDraft.mutateAsync({ draftId, title: titleValue.trim() });
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed to save title'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!draftId) return;
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    try {
      await deleteDraft.mutateAsync({ draftId, organizationId });
      showToast('Draft deleted', 'success');
      onBack();
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Delete failed'), 'error');
    }
  };

  const handleArchive = async () => {
    if (!draftId) return;
    try {
      await archiveDraft.mutateAsync({ draftId, organizationId });
      showToast('Draft archived', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Archive failed'), 'error');
    }
  };

  const handleSubmitForReview = async () => {
    if (!draftId) return;
    try {
      await updateDraft.mutateAsync({ draftId, status: 'review' });
      showToast('Submitted for review', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed'), 'error');
    }
  };

  const handlePublish = async (notes: string) => {
    if (!draftId) return;
    try {
      await publishDraft.mutateAsync({ draftId, organizationId, publishNotes: notes });
      setShowPublishModal(false);
      showToast('Published!', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Publish failed'), 'error');
    }
  };

  const handleReviewDecision = async (decision: ReviewDecision, notes: string) => {
    if (!draftId) return;
    try {
      await submitReview.mutateAsync({ draftId, decision, notes, organizationId });
      setShowReviewModal(false);
      showToast(
        decision === 'approved' ? 'Review approved' :
        decision === 'changes_requested' ? 'Changes requested' :
        'Review rejected',
        decision === 'approved' ? 'success' : 'error'
      );
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed'), 'error');
    }
  };

  if (!draftId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <AlertCircle className="w-12 h-12 text-slate-200 mb-3" />
        <p className="text-sm font-medium text-slate-500">No draft selected</p>
        <button onClick={onBack} className="mt-3 text-sm text-blue-600 hover:underline">Back to Studio</button>
      </div>
    );
  }

  if (isLoading) return <SkeletonDetail />;

  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-200 mb-3" />
        <p className="text-sm font-medium text-slate-600">Failed to load draft</p>
        <button onClick={() => refetch()} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
      </div>
    );
  }

  const OutputIcon = OUTPUT_TYPE_ICONS[draft.output_type as OutputType] ?? FileText;
  const isPublished = draft.status === 'published';
  const isArchived = draft.status === 'archived';
  const isReview = draft.status === 'review';
  const isApproved = draft.status === 'approved';
  const canSubmitForReview = draft.status === 'draft';
  const safeTargetUrl = draft.target_url && isSafeExternalUrl(draft.target_url) ? draft.target_url : null;

  type TabEntry = { id: Tab; label: string } | { divider: true };

  const TABS: TabEntry[] = [
    { id: 'editor', label: 'Editor' },
    { id: 'generated', label: 'Generated' },
    { id: 'diff', label: 'Diff' },
    { id: 'transcript', label: 'Transcript' },
    { divider: true },
    { id: 'scenes', label: 'Scenes' },
    { id: 'narration', label: 'Narration' },
    { id: 'captions', label: 'Captions' },
    { id: 'pronunciation', label: 'Pronunciation' },
    { divider: true },
    { id: 'quality', label: 'Quality' },
    { id: 'drift', label: 'Drift' },
    { id: 'variants', label: 'Variants' },
    { id: 'export', label: 'Export' },
    { divider: true },
    { id: 'assembly', label: 'Assembly' },
    { id: 'audio', label: 'Audio' },
    { id: 'timing', label: 'Timing' },
    { id: 'package_manifest', label: 'Package' },
    { divider: true },
    { id: 'render', label: 'Render' },
    { divider: true },
    { id: 'shot_plans', label: 'Shot Plans' },
    { divider: true },
    { id: 'integrity', label: 'Integrity' },
    { id: 'revalidation', label: 'Revalidation' },
    { divider: true },
    { id: 'review', label: 'Review' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 bg-white flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Studio</span>
          </button>

          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

          {titleEditing ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setTitleEditing(false); setTitleValue(draft.title); } }}
              className="text-sm font-semibold text-slate-800 bg-transparent border-b-2 border-blue-500 outline-none min-w-0 flex-1 py-0.5"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setTitleEditing(true); setTimeout(() => titleInputRef.current?.select(), 0); }}
              className="text-sm font-semibold text-slate-800 hover:text-blue-700 truncate text-left min-w-0 flex-1 group"
              title="Click to edit title"
            >
              {draft.title || 'Untitled Draft'}
            </button>
          )}

          <DraftStatusBadge status={draft.status} size="sm" />

          {draft.version_label && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
              {draft.version_label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs hidden sm:inline ${
            saveState === 'saved' ? 'text-emerald-500' :
            saveState === 'saving' ? 'text-amber-500' :
            'text-slate-400'
          }`}>
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved'}
          </span>

          <button
            onClick={handleSaveNow}
            disabled={updateDraft.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {updateDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>

          {canSubmitForReview && (
            <button
              onClick={handleSubmitForReview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <SendHorizonal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Review</span>
            </button>
          )}

          {isReview && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Review</span>
            </button>
          )}

          {isApproved && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Publish</span>
            </button>
          )}

          {isPublished && safeTargetUrl && (
            <a
              href={safeTargetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Live
            </a>
          )}
          {isPublished && draft.target_url && !safeTargetUrl && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-slate-200 bg-slate-100 cursor-not-allowed"
              aria-disabled="true"
              title="Live URL unavailable"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Link unavailable
            </span>
          )}

          {!isArchived && (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              title="Generate finished tutorial video"
            >
              <Film className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Generate</span>
            </button>
          )}

          <button
            onClick={() => setShowAssets(s => !s)}
            title={showAssets ? 'Hide assets panel' : 'Show assets panel'}
            className={`p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors ${showAssets ? 'bg-slate-100 text-slate-800' : ''}`}
          >
            {showAssets ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>

          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(s => !s)}
              className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1 overflow-hidden">
                {!isArchived && (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleArchive(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
                <button
                  onClick={() => { setShowMoreMenu(false); handleDelete(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto flex flex-col">
          <div className="p-4 space-y-4 flex-1">
            <div className="space-y-3">
              <MetaField label="Type">
                <div className="flex items-center gap-1.5">
                  <OutputIcon className="w-4 h-4 text-slate-500" />
                  <span>{OUTPUT_TYPE_LABELS[draft.output_type as OutputType]}</span>
                </div>
              </MetaField>

              <MetaField label="Target Role">
                <span className="capitalize">{ROLE_LABELS[draft.target_role as TargetRole] ?? draft.target_role}</span>
              </MetaField>

              {draft.target_url && (
                <MetaField label="Target URL">
                  {safeTargetUrl ? (
                    <a
                      href={safeTargetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs break-all"
                    >
                      {safeTargetUrl}
                    </a>
                  ) : (
                    <span
                      className="text-slate-400 text-xs"
                      aria-disabled="true"
                    >
                      URL unavailable
                    </span>
                  )}
                </MetaField>
              )}

              {draft.description && (
                <MetaField label="Description">
                  <p className="text-sm text-slate-600 leading-relaxed">{draft.description}</p>
                </MetaField>
              )}

              <MetaField label="Updated">
                <span className="text-xs text-slate-500">
                  {new Date(draft.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </MetaField>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <StepList
                steps={draft.steps ?? []}
                draftId={draftId}
                draftTitle={draft.title}
                draftDescription={draft.description ?? undefined}
                organizationId={organizationId}
                onStepsGenerated={() => refetch()}
              />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <CompletenessIndicator
                draft={{ ...draft, edited_content: editedContent }}
                compact={false}
              />
            </div>

            {(latestRenderJob || allRenderJobs.length > 0) && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Final Output</p>
                <FinalOutputMiniSummary
                  jobs={allRenderJobs}
                  onClick={() => setActiveTab('render')}
                />
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-700 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Film size={11} />
                  Generate New
                </button>
              </div>
            )}

            {draft.reviews && draft.reviews.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Review History</p>
                <div className="space-y-2">
                  {draft.reviews.slice(0, 3).map(rev => (
                    <div key={rev.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-semibold capitalize ${
                          rev.decision === 'approved' ? 'text-emerald-600' :
                          rev.decision === 'changes_requested' ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {rev.decision.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(rev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {rev.notes && <p className="text-xs text-slate-500 line-clamp-2">{rev.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-slate-200 bg-white flex-shrink-0 px-1 overflow-x-auto">
            {TABS.map((tab, i) => {
              if ('divider' in tab) {
                return <div key={`div-${i}`} className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0 self-center" />;
              }
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden bg-white">
            {activeTab === 'editor' && (
              <EditorTab
                editedContent={editedContent}
                onChange={handleContentChange}
                saveState={saveState}
                readOnly={isPublished || isArchived}
              />
            )}
            {activeTab === 'generated' && (
              <GeneratedTab
                generatedContent={draft.generated_content ?? {}}
                editedContent={editedContent}
                onCopyToEditor={md => {
                  handleContentChange({ ...editedContent, guide_md: md });
                  setActiveTab('editor');
                  showToast('Copied to editor', 'success');
                }}
              />
            )}
            {activeTab === 'diff' && (
              <DiffViewer
                original={draft.generated_content?.guide_md ?? ''}
                edited={editedContent.guide_md ?? draft.edited_content?.guide_md ?? ''}
                onRevert={() => {
                  const original = draft.generated_content?.guide_md ?? '';
                  handleContentChange({ ...editedContent, guide_md: original });
                  showToast('Reverted to generated', 'success');
                }}
              />
            )}
            {activeTab === 'transcript' && (
              <TranscriptTab
                generatedContent={draft.generated_content ?? {}}
                editedContent={editedContent}
                onChange={handleContentChange}
                saveState={saveState}
                readOnly={isPublished || isArchived}
              />
            )}
            {activeTab === 'scenes' && (
              <div className="flex-1 overflow-y-auto p-4"><ScenesTab draftId={draftId} /></div>
            )}
            {activeTab === 'narration' && (
              <div className="flex-1 overflow-y-auto p-4"><NarrationTab draftId={draftId} /></div>
            )}
            {activeTab === 'captions' && (
              <div className="flex-1 overflow-y-auto p-4"><CaptionsTab draftId={draftId} organizationId={organizationId} /></div>
            )}
            {activeTab === 'pronunciation' && (
              <div className="flex-1 overflow-y-auto p-4"><PronunciationTab /></div>
            )}
            {activeTab === 'quality' && (
              <div className="flex-1 overflow-y-auto p-4"><QualityTab draftId={draftId} onNavigateToTab={handleNavigateToTab} /></div>
            )}
            {activeTab === 'drift' && (
              <div className="flex-1 overflow-y-auto p-4"><DriftTab draftId={draftId} /></div>
            )}
            {activeTab === 'variants' && (
              <div className="flex-1 overflow-y-auto p-4"><VariantsTab draftId={draftId} /></div>
            )}
            {activeTab === 'export' && (
              <div className="flex-1 overflow-y-auto p-4"><ExportTab draftId={draftId} onNavigateToTab={handleNavigateToTab} /></div>
            )}
            {activeTab === 'assembly' && (
              <div className="flex-1 overflow-y-auto p-4">
                <AssemblyTab draftId={draftId} organizationId={organizationId} currentAssemblyStatus={(draft.assembly_status as AssemblyStatus | null | undefined)} />
              </div>
            )}
            {activeTab === 'audio' && (
              <div className="flex-1 overflow-y-auto p-4">
                <AudioTab draftId={draftId} organizationId={organizationId} />
              </div>
            )}
            {activeTab === 'timing' && (
              <div className="flex-1 overflow-y-auto p-4">
                <TimingTab draftId={draftId} />
              </div>
            )}
            {activeTab === 'package_manifest' && (
              <div className="flex-1 overflow-y-auto p-4">
                <PackageManifestTab draftId={draftId} organizationId={organizationId} />
              </div>
            )}
            {activeTab === 'render' && (
              <div className="flex-1 overflow-y-auto p-4">
                <RenderTab
                  draftId={draftId}
                  organizationId={organizationId}
                  draftTitle={draft.title}
                />
              </div>
            )}
            {activeTab === 'shot_plans' && (
              <div className="flex-1 overflow-y-auto p-4"><ShotPlansTab draftId={draftId} /></div>
            )}
            {activeTab === 'integrity' && (
              <div className="flex-1 overflow-y-auto p-4"><IntegrityTab draftId={draftId} organizationId={organizationId} /></div>
            )}
            {activeTab === 'revalidation' && (
              <div className="flex-1 overflow-y-auto p-4"><RevalidationTab draftId={draftId} /></div>
            )}
            {activeTab === 'review' && (
              <div className="flex-1 overflow-hidden flex flex-col p-4">
                <ReviewTab draftId={draftId} organizationId={organizationId} />
              </div>
            )}
          </div>
        </div>

        {showAssets && (
          <div className="w-72 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Assets</p>
              <span className="text-xs text-slate-400">{(draft.assets ?? []).length} files</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AssetsPanel draft={draft} organizationId={organizationId} />
            </div>
          </div>
        )}
      </div>

      {showPublishModal && (
        <PublishConfirmModal
          draft={{ ...draft, edited_content: editedContent }}
          onConfirm={handlePublish}
          onClose={() => setShowPublishModal(false)}
          isLoading={publishDraft.isPending}
        />
      )}

      {showReviewModal && (
        <ReviewSubmitModal
          draft={{ ...draft, edited_content: editedContent }}
          onConfirm={handleReviewDecision}
          onClose={() => setShowReviewModal(false)}
          isLoading={submitReview.isPending}
          packageManifest={packageManifest}
        />
      )}

      {showGenerateModal && (
        <GenerateFinishedTutorialModal
          draftId={draftId}
          organizationId={organizationId}
          draftTitle={draft.title}
          onClose={() => setShowGenerateModal(false)}
          onJobStarted={() => {
            setShowGenerateModal(false);
            setActiveTab('render');
          }}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { BookOpen, Plus, Search, LayoutGrid, List, FileText, Video, Mic, Clock, ChevronRight, Trash2, Archive, Eye, Loader as Loader2, CircleAlert as AlertCircle, Film, Package, Zap, CircleCheck as CheckCircle2, X, ShieldCheck, Sparkles } from 'lucide-react';
import type { IntegrityStatus } from '../../types/documentation';
import { INTEGRITY_STATUS_LABELS, INTEGRITY_STATUS_COLORS } from '../../types/documentation';
import { useDocStudioDrafts, useCreateDraft, useDeleteDraft, useArchiveDraft } from '../../hooks/useDocStudio';
import { useRenderQueueStats } from '../../hooks/useDocStudioRenderJobs';
import { DraftStatusBadge } from './DraftStatusBadge';
import { ReviewStageBadge } from './review/ReviewStageBadge';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import type { DraftStatus, OutputType, ProviderMode, AssemblyStatus } from '../../types/doc-studio';
import type { DraftListItem } from '../../types/doc-studio';
import type { ReviewWorkflowStage } from '../../types/doc-studio-review';
import type { RenderQueueStats } from '../../services/documentation/render/renderJobService';

const ASSEMBLY_STATUS_CONFIG: Record<AssemblyStatus, { label: string; className: string; Icon: React.ElementType }> = {
  assembled: { label: 'Assembled', className: 'bg-emerald-50 text-emerald-700', Icon: Package },
  assembling: { label: 'Assembling…', className: 'bg-amber-50 text-amber-700', Icon: Loader2 },
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-500', Icon: Zap },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-600', Icon: AlertCircle },
};

function AssemblyBadge({ status }: { status: AssemblyStatus | null | undefined }) {
  if (!status) return null;
  const cfg = ASSEMBLY_STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.className}`}>
      <cfg.Icon size={9} className={status === 'assembling' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}

function IntegrityBadge({ status, score }: { status: IntegrityStatus | null | undefined; score?: number | null }) {
  if (!status || status === 'unknown') return null;
  const label = INTEGRITY_STATUS_LABELS[status];
  const className = INTEGRITY_STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${className}`}>
      <ShieldCheck size={9} />
      {label}{score != null ? ` · ${score}%` : ''}
    </span>
  );
}

function RenderQueueBanner({ stats, onDismiss }: { stats: RenderQueueStats; onDismiss: () => void }) {
  const hasActive = stats.active > 0;
  const hasFailed = stats.failed > 0;
  if (!hasActive && !hasFailed && stats.completedToday === 0) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm mb-6 ${hasActive ? 'bg-blue-50 border-blue-200' : hasFailed ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      {hasActive ? (
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
      ) : hasFailed ? (
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      )}
      <span className={`font-medium ${hasActive ? 'text-blue-800' : hasFailed ? 'text-amber-800' : 'text-slate-700'}`}>
        {hasActive
          ? `${stats.active} render job${stats.active !== 1 ? 's' : ''} in progress`
          : hasFailed
          ? `${stats.failed} render job${stats.failed !== 1 ? 's' : ''} failed`
          : `${stats.completedToday} render${stats.completedToday !== 1 ? 's' : ''} completed today`}
      </span>
      {stats.completedToday > 0 && hasActive && (
        <span className="text-xs text-blue-600 ml-1">· {stats.completedToday} completed today</span>
      )}
      {stats.totalCompleted > 0 && (
        <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
          <Film size={11} />
          {stats.totalCompleted} total
        </span>
      )}
      <button onClick={onDismiss} className="p-0.5 rounded hover:bg-black/10 text-slate-400 ml-1" aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}

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

const STATUS_TABS: Array<{ value: DraftStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

interface NewDraftForm {
  title: string;
  description: string;
  targetUrl: string;
  outputType: OutputType;
  providerMode: ProviderMode;
}

interface Props {
  organizationId: string | undefined;
  onOpenDraft: (id: string) => void;
  onGenerateWithAI?: () => void;
}

export function DocStudioIndex({ organizationId, onOpenDraft, onGenerateWithAI }: Props) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.is_super_admin === true;
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<DraftStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewDraftForm>({
    title: '',
    description: '',
    targetUrl: '',
    outputType: 'screenshot_guide',
    providerMode: 'mock',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: drafts = [], isLoading, isError, error: draftsError, refetch } = useDocStudioDrafts({
    organizationId,
    status: statusFilter,
    search,
    isSuperAdmin,
  });

  const { data: queueStats } = useRenderQueueStats(organizationId ?? null);

  const createDraft = useCreateDraft();
  const deleteDraft = useDeleteDraft();
  const archiveDraft = useArchiveDraft();

  async function handleCreate() {
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    if (!organizationId) { showToast('Organization context required', 'error'); return; }
    try {
      const draft = await createDraft.mutateAsync({
        organizationId,
        title: form.title,
        description: form.description,
        targetUrl: form.targetUrl,
        outputType: form.outputType,
        providerMode: form.providerMode,
      });
      setShowCreate(false);
      setForm({ title: '', description: '', targetUrl: '', outputType: 'screenshot_guide', providerMode: 'mock' });
      showToast('Draft created', 'success');
      onOpenDraft(draft.id);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDraft.mutateAsync({ draftId: id, organizationId: organizationId! });
      setDeleteConfirm(null);
      showToast('Draft deleted', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveDraft.mutateAsync({ draftId: id, organizationId: organizationId! });
      showToast('Draft archived', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  const canCreate = profile?.role === 'org_admin' || profile?.role === 'admin' || profile?.is_super_admin || profile?.role === 'provider';

  const integrityStats = drafts.length > 0 ? {
    healthy: drafts.filter(d => d.integrity_status === 'healthy').length,
    needsAction: drafts.filter(d => d.integrity_status && !['healthy', 'unknown', null].includes(d.integrity_status as string)).length,
    revalidationRequired: drafts.filter(d => d.revalidation_required).length,
    total: drafts.filter(d => d.integrity_status && d.integrity_status !== 'unknown').length,
  } : null;

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Documentation Studio</h1>
              </div>
              <p className="text-sm text-slate-500">Create guides and video tutorials for your practice — powered by AI</p>
            </div>
          </div>

          {canCreate && (
            <div className="flex flex-col sm:flex-row gap-3">
              {onGenerateWithAI && (
                <button
                  onClick={onGenerateWithAI}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                  <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">Recommended</span>
                </button>
              )}
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 active:scale-[0.99] transition-all"
              >
                <Plus className="w-4 h-4" />
                New blank draft
              </button>
            </div>
          )}
        </div>

        {/* Render queue banner */}
        {queueStats && !bannerDismissed && (
          <RenderQueueBanner stats={queueStats} onDismiss={() => setBannerDismissed(true)} />
        )}

        {/* Integrity stats strip */}
        {integrityStats && integrityStats.total > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 font-medium">Integrity:</span>
            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {integrityStats.healthy} healthy
            </span>
            {integrityStats.needsAction > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                {integrityStats.needsAction} need action
              </span>
            )}
            {integrityStats.revalidationRequired > 0 && (
              <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                {integrityStats.revalidationRequired} need revalidation
              </span>
            )}
            <span className="text-slate-300 ml-auto">{integrityStats.total} / {drafts.length} checked</span>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drafts…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-slate-500">Failed to load drafts</p>
            {draftsError instanceof Error && draftsError.message && (
              <p className="text-xs text-red-400 max-w-md text-center">{draftsError.message}</p>
            )}
            <button onClick={() => refetch()} className="text-sm text-blue-600 underline">Retry</button>
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState onNew={() => setShowCreate(true)} onGenerateWithAI={onGenerateWithAI} canCreate={canCreate} />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {drafts.map(d => (
              <DraftCard
                key={d.id}
                draft={d}
                onOpen={() => onOpenDraft(d.id)}
                onArchive={() => handleArchive(d.id)}
                onDeleteRequest={() => setDeleteConfirm(d.id)}
              />
            ))}
          </div>
        ) : (
          <DraftTable
            drafts={drafts}
            onOpen={onOpenDraft}
            onArchive={handleArchive}
            onDeleteRequest={setDeleteConfirm}
          />
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          form={form}
          onChange={setForm}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          loading={createDraft.isPending}
        />
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete Draft?</h3>
            <p className="text-sm text-slate-500 mb-6">This will permanently delete the draft and all its assets. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft, onOpen, onArchive, onDeleteRequest }: {
  draft: DraftListItem;
  onOpen: () => void;
  onArchive: () => void;
  onDeleteRequest: () => void;
}) {
  const Icon = OUTPUT_TYPE_ICONS[draft.output_type] ?? FileText;
  const scoreColor = draft.completeness_score >= 80 ? 'bg-emerald-400' : draft.completeness_score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div
      className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
      onClick={onOpen}
    >
      <div className="relative bg-gradient-to-br from-blue-50 to-slate-100 h-32 flex items-center justify-center">
        <Icon className="w-12 h-12 text-blue-300" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200">
          <div
            className={`h-full transition-all ${scoreColor}`}
            style={{ width: `${Math.min(100, draft.completeness_score)}%` }}
          />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 flex-1">{draft.title}</h3>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <DraftStatusBadge status={draft.status} size="sm" />
            {draft.status === 'review' && draft.review_workflow_stage && (
              <ReviewStageBadge stage={draft.review_workflow_stage as ReviewWorkflowStage} size="sm" />
            )}
          </div>
        </div>
        {draft.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{draft.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Icon className="w-3 h-3" />
            <span>{OUTPUT_TYPE_LABELS[draft.output_type]}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${scoreColor}`} />
              <span>{draft.completeness_score}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{new Date(draft.updated_at).toLocaleDateString()}</span>
            <span className="mx-1">·</span>
            <span>{draft.steps?.length ?? 0} steps</span>
          </div>
          <div className="flex items-center gap-1">
            <IntegrityBadge status={draft.integrity_status} score={draft.integrity_score} />
            <AssemblyBadge status={draft.assembly_status} />
          </div>
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onArchive(); }}
          className="p-1.5 bg-white/90 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
          title="Archive"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDeleteRequest(); }}
          className="p-1.5 bg-white/90 border border-slate-200 rounded-lg hover:bg-red-50 text-red-500"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function DraftTable({ drafts, onOpen, onArchive, onDeleteRequest }: {
  drafts: DraftListItem[];
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Steps</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Assembly</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Integrity</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Updated</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {drafts.map(d => {
            const Icon = OUTPUT_TYPE_ICONS[d.output_type] ?? FileText;
            const scoreColor = d.completeness_score >= 80 ? 'text-emerald-600' : d.completeness_score >= 50 ? 'text-amber-600' : 'text-red-500';
            return (
              <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(d.id)}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{d.title}</div>
                  {d.description && <div className="text-xs text-slate-400 truncate max-w-xs">{d.description}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <div className="flex items-center gap-1">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs">{OUTPUT_TYPE_LABELS[d.output_type]}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <DraftStatusBadge status={d.status} size="sm" />
                    {d.status === 'review' && d.review_workflow_stage && (
                      <ReviewStageBadge stage={d.review_workflow_stage as ReviewWorkflowStage} size="sm" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{d.steps?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${scoreColor}`}>{d.completeness_score}%</span>
                </td>
                <td className="px-4 py-3">
                  {d.assembly_status ? (
                    <AssemblyBadge status={d.assembly_status} />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {d.integrity_status && d.integrity_status !== 'unknown' ? (
                    <IntegrityBadge status={d.integrity_status} score={d.integrity_score} />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(d.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onOpen(d.id)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onArchive(d.id)} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded">
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteRequest(d.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ onNew, onGenerateWithAI, canCreate }: { onNew: () => void; onGenerateWithAI?: () => void; canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-6">
        <Film className="w-10 h-10 text-blue-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">No documentation drafts yet</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        Describe what you want to document and AI will generate a complete guide and video tutorial for you.
      </p>
      {canCreate && (
        <div className="flex flex-col items-center gap-3">
          {onGenerateWithAI && (
            <button
              onClick={onGenerateWithAI}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          )}
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New blank draft
          </button>
        </div>
      )}
    </div>
  );
}

const OUTPUT_OPTIONS: Array<{ value: OutputType; label: string; description: string; Icon: React.ElementType }> = [
  { value: 'screenshot_guide', label: 'Screenshot Guide', description: 'Step-by-step with annotated screenshots', Icon: FileText },
  { value: 'video_tutorial', label: 'Video Tutorial', description: 'Screen recording with narration', Icon: Video },
  { value: 'narrated_video', label: 'Narrated Video', description: 'Video with AI voice narration', Icon: Mic },
];

function CreateModal({ form, onChange, onSubmit, onClose, loading }: {
  form: NewDraftForm;
  onChange: (f: NewDraftForm) => void;
  onSubmit: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">New Documentation Draft</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
            <input
              value={form.title}
              onChange={e => onChange({ ...form, title: e.target.value })}
              placeholder="e.g. How to Schedule a Patient Appointment"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => onChange({ ...form, description: e.target.value })}
              placeholder="What does this guide cover?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Target URL</label>
            <input
              value={form.targetUrl}
              onChange={e => onChange({ ...form, targetUrl: e.target.value })}
              placeholder="https://…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Output Type</label>
            <div className="grid grid-cols-3 gap-2">
              {OUTPUT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onChange({ ...form, outputType: opt.value })}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-colors ${
                    form.outputType === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <opt.Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !form.title.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Draft
          </button>
        </div>
      </div>
    </div>
  );
}

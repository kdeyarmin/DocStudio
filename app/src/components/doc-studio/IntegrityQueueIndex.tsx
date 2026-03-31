import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Search, RefreshCw, Loader as Loader2, Clock, TriangleAlert as AlertTriangle, ChevronRight, LayoutGrid, List, ListFilter as Filter } from 'lucide-react';
import {
  useDocStudioIntegrityQueue,
  useRunIntegrityCheck,
} from '../../hooks/useDocStudioIntegrity';
import { useToast } from '../../lib/toast';
import type { IntegrityStatus } from '../../types/documentation';
import {
  INTEGRITY_STATUS_LABELS,
  INTEGRITY_STATUS_COLORS,
} from '../../types/documentation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueDraft {
  id: string;
  title: string;
  integrity_status: IntegrityStatus | null;
  integrity_score: number | null;
  revalidation_required: boolean | null;
  last_captured_at: string | null;
  updated_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<IntegrityStatus, React.ReactElement> = {
  unknown: <ShieldCheck size={14} className="text-slate-400" />,
  healthy: <ShieldCheck size={14} className="text-green-500" />,
  warning: <ShieldAlert size={14} className="text-amber-500" />,
  needs_review: <ShieldAlert size={14} className="text-orange-500" />,
  needs_recapture: <ShieldX size={14} className="text-red-500" />,
  outdated: <ShieldX size={14} className="text-rose-500" />,
  incomplete: <ShieldX size={14} className="text-yellow-500" />,
  failed_validation: <ShieldX size={14} className="text-red-700" />,
};

const FILTER_OPTIONS: (IntegrityStatus | 'all' | 'revalidation_needed')[] = [
  'all',
  'revalidation_needed',
  'failed_validation',
  'needs_recapture',
  'needs_review',
  'warning',
  'incomplete',
  'healthy',
  'unknown',
];

const FILTER_LABELS: Record<typeof FILTER_OPTIONS[number], string> = {
  all: 'All',
  revalidation_needed: 'Needs Revalidation',
  failed_validation: INTEGRITY_STATUS_LABELS.failed_validation,
  needs_recapture: INTEGRITY_STATUS_LABELS.needs_recapture,
  needs_review: INTEGRITY_STATUS_LABELS.needs_review,
  warning: INTEGRITY_STATUS_LABELS.warning,
  incomplete: INTEGRITY_STATUS_LABELS.incomplete,
  healthy: INTEGRITY_STATUS_LABELS.healthy,
  unknown: INTEGRITY_STATUS_LABELS.unknown,
  outdated: INTEGRITY_STATUS_LABELS.outdated,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const ms = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-slate-200';
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-amber-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

// ─── DraftRow (list view) ─────────────────────────────────────────────────────

function DraftRow({
  draft,
  onRunCheck,
  isRunning,
  onNavigate,
}: {
  draft: QueueDraft;
  onRunCheck: (id: string) => void;
  isRunning: boolean;
  onNavigate?: (id: string) => void;
}) {
  const status = draft.integrity_status ?? 'unknown';
  const statusCfg = INTEGRITY_STATUS_COLORS[status];

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      <div className="w-5 flex justify-center flex-shrink-0">{STATUS_ICON[status]}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-700 truncate">{draft.title || 'Untitled Draft'}</p>
          {draft.revalidation_required && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={9} />
              revalidate
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
          <span>Updated {relativeTime(draft.updated_at)}</span>
          {draft.last_captured_at && (
            <span>· Captured {relativeTime(draft.last_captured_at)}</span>
          )}
        </p>
      </div>

      {/* Score bar */}
      <div className="w-24 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBarColor(draft.integrity_score)}`}
              style={{ width: `${draft.integrity_score ?? 0}%` }}
            />
          </div>
          <span className={`text-xs font-semibold w-8 text-right ${scoreTextColor(draft.integrity_score)}`}>
            {draft.integrity_score !== null ? Math.round(draft.integrity_score) : '–'}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div className="w-32 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg}`}>
          {INTEGRITY_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => onRunCheck(draft.id)}
          disabled={isRunning}
          title="Run integrity check"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
        {onNavigate && (
          <button
            onClick={() => onNavigate(draft.id)}
            title="Open draft"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DraftCard (grid view) ────────────────────────────────────────────────────

function DraftCard({
  draft,
  onRunCheck,
  isRunning,
  onNavigate,
}: {
  draft: QueueDraft;
  onRunCheck: (id: string) => void;
  isRunning: boolean;
  onNavigate?: (id: string) => void;
}) {
  const status = draft.integrity_status ?? 'unknown';
  const statusCfg = INTEGRITY_STATUS_COLORS[status];
  const score = draft.integrity_score;

  return (
    <div className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-shadow bg-white space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 leading-snug line-clamp-2">
            {draft.title || 'Untitled Draft'}
          </p>
          {draft.revalidation_required && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={9} />
              Revalidation Required
            </span>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg}`}>
          {STATUS_ICON[status]}
          {INTEGRITY_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Score */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Integrity Score</span>
          <span className={`font-semibold ${scoreTextColor(score)}`}>
            {score !== null ? `${Math.round(score)}/100` : '–'}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${scoreBarColor(score)}`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <Clock size={9} />
        <span>Updated {relativeTime(draft.updated_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
        <button
          onClick={() => onRunCheck(draft.id)}
          disabled={isRunning}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
        >
          {isRunning ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Check
        </button>
        {onNavigate && (
          <button
            onClick={() => onNavigate(draft.id)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 ml-auto transition-colors"
          >
            Open
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ drafts }: { drafts: QueueDraft[] }) {
  const total = drafts.length;
  const healthy = drafts.filter((d) => d.integrity_status === 'healthy').length;
  const needsAction = drafts.filter((d) =>
    ['failed_validation', 'needs_recapture', 'needs_review', 'warning', 'outdated'].includes(d.integrity_status ?? ''),
  ).length;
  const revalidate = drafts.filter((d) => d.revalidation_required).length;
  const unknown = drafts.filter((d) => !d.integrity_status || d.integrity_status === 'unknown').length;

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Total', value: total, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-100' },
        { label: 'Healthy', value: healthy, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' },
        { label: 'Needs Action', value: needsAction, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
        { label: 'Revalidate', value: revalidate, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100' },
      ].map(({ label, value, color, bg, border }) => (
        <div key={label} className={`${bg} ${border} border rounded-xl px-4 py-3`}>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </div>
      ))}
      {unknown > 0 && (
        <div className="col-span-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
          <AlertTriangle size={12} />
          {unknown} draft{unknown !== 1 ? 's' : ''} have never had an integrity check run.
        </div>
      )}
    </div>
  );
}

// ─── IntegrityQueueIndex ──────────────────────────────────────────────────────

interface IntegrityQueueIndexProps {
  onNavigateToDraft?: (draftId: string) => void;
}

export function IntegrityQueueIndex({ onNavigateToDraft }: IntegrityQueueIndexProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const { data: drafts, isLoading, refetch, isFetching } = useDocStudioIntegrityQueue(100);
  const runCheck = useRunIntegrityCheck();
  const { showToast } = useToast();

  const allDrafts = (drafts ?? []) as QueueDraft[];

  const filtered = allDrafts.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.title?.toLowerCase().includes(q)) return false;
    }
    if (filter === 'all') return true;
    if (filter === 'revalidation_needed') return !!d.revalidation_required;
    return (d.integrity_status ?? 'unknown') === filter;
  });

  function handleRunCheck(draftId: string) {
    setRunningIds((prev) => new Set(prev).add(draftId));
    runCheck.mutate(
      { draft_id: draftId },
      {
        onSuccess: () => {
          showToast('Integrity check complete', 'success');
          setRunningIds((prev) => { const s = new Set(prev); s.delete(draftId); return s; });
        },
        onError: (e) => {
          showToast(e.message, 'error');
          setRunningIds((prev) => { const s = new Set(prev); s.delete(draftId); return s; });
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Integrity Queue</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor and validate tutorial integrity across all drafts.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>

      {/* Stats */}
      {!isLoading && allDrafts.length > 0 && <StatsBar drafts={allDrafts} />}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drafts…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof FILTER_OPTIONS[number])}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{FILTER_LABELS[opt]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={13} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ShieldCheck size={28} className="text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">
            {search || filter !== 'all' ? 'No drafts match your filters' : 'No drafts found'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
          {filtered.map((d) => (
            <DraftRow
              key={d.id}
              draft={d}
              onRunCheck={handleRunCheck}
              isRunning={runningIds.has(d.id)}
              onNavigate={onNavigateToDraft}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onRunCheck={handleRunCheck}
              isRunning={runningIds.has(d.id)}
              onNavigate={onNavigateToDraft}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-[10px] text-slate-400 text-right">
          Showing {filtered.length} of {allDrafts.length} draft{allDrafts.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

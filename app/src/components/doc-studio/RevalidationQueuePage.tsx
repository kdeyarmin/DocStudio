import { useState, useMemo } from 'react';
import { ShieldX, ShieldCheck, ShieldAlert, Clock, Activity, MicOff, Bubbles as Subtitles, Camera, ImageOff, Search, RefreshCw, Loader as Loader2, ChevronDown, ChevronRight, ArrowUpDown, TriangleAlert as AlertTriangle, ExternalLink, RotateCcw, CircleCheck as CheckCircle2, Eye, EyeOff, Play } from 'lucide-react';
import {
  useRevalidationQueueFull,
  useRunIntegrityCheck,
  useMarkDraftValidated,
  useRequestRecapture,
  useResolveDrift,
  type RevalidationQueueDraft,
} from '../../hooks/useDocStudioIntegrity';
import { useToast } from '../../lib/toast';

// ─── Issue Types ──────────────────────────────────────────────────────────────

type IssueKey = 'outdated' | 'drift' | 'failed' | 'no_hero' | 'no_narration' | 'no_captions' | 'recapture';

interface IssueDef {
  key: IssueKey;
  label: string;
  shortLabel: string;
  description: string;
  Icon: React.ElementType;
  badgeCls: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  dotCls: string;
}

const ISSUE_DEFS: IssueDef[] = [
  {
    key: 'outdated',
    label: 'Outdated',
    shortLabel: 'Outdated',
    description: 'Marked as outdated or requires revalidation',
    Icon: Clock,
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
    cardBg: 'bg-rose-50',
    cardBorder: 'border-rose-200',
    cardText: 'text-rose-700',
    dotCls: 'bg-rose-500',
  },
  {
    key: 'drift',
    label: 'Drift Detected',
    shortLabel: 'Drift',
    description: 'Content has drifted from source screenshots or narration',
    Icon: Activity,
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
    cardBg: 'bg-amber-50',
    cardBorder: 'border-amber-200',
    cardText: 'text-amber-700',
    dotCls: 'bg-amber-500',
  },
  {
    key: 'failed',
    label: 'Integrity Failure',
    shortLabel: 'Failed',
    description: 'Overall score below threshold or validation failed',
    Icon: ShieldX,
    badgeCls: 'bg-red-50 text-red-700 border-red-200',
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-200',
    cardText: 'text-red-700',
    dotCls: 'bg-red-500',
  },
  {
    key: 'no_hero',
    label: 'Missing Hero Shot',
    shortLabel: 'No Hero',
    description: 'Screenshot score is low or hero image is absent',
    Icon: ImageOff,
    badgeCls: 'bg-orange-50 text-orange-700 border-orange-200',
    cardBg: 'bg-orange-50',
    cardBorder: 'border-orange-200',
    cardText: 'text-orange-700',
    dotCls: 'bg-orange-500',
  },
  {
    key: 'no_narration',
    label: 'Missing Narration',
    shortLabel: 'No Audio',
    description: 'Narration score is low or audio has not been generated',
    Icon: MicOff,
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200',
    cardBg: 'bg-sky-50',
    cardBorder: 'border-sky-200',
    cardText: 'text-sky-700',
    dotCls: 'bg-sky-500',
  },
  {
    key: 'no_captions',
    label: 'Missing Captions',
    shortLabel: 'No Captions',
    description: 'Caption score is low or captions have not been generated',
    Icon: Subtitles,
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-200',
    cardText: 'text-blue-700',
    dotCls: 'bg-blue-500',
  },
  {
    key: 'recapture',
    label: 'Needs Recapture',
    shortLabel: 'Recapture',
    description: 'Capture quality is low or recapture was explicitly requested',
    Icon: Camera,
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
    cardBg: 'bg-slate-100',
    cardBorder: 'border-slate-300',
    cardText: 'text-slate-700',
    dotCls: 'bg-slate-500',
  },
];

const ISSUE_DEF_MAP = new Map(ISSUE_DEFS.map((d) => [d.key, d]));

// ─── Category score config ────────────────────────────────────────────────────

interface CatScoreDef {
  key: keyof import('../../hooks/useDocStudioIntegrity').RevalidationQueueReport;
  label: string;
}

const CAT_SCORES: CatScoreDef[] = [
  { key: 'capture_score', label: 'Capture' },
  { key: 'screenshot_score', label: 'Screenshots' },
  { key: 'narration_score', label: 'Narration' },
  { key: 'caption_score', label: 'Captions' },
  { key: 'content_score', label: 'Content' },
  { key: 'scene_score', label: 'Scenes' },
  { key: 'shot_plan_score', label: 'Shot Plans' },
  { key: 'drift_score', label: 'Drift' },
  { key: 'render_score', label: 'Render' },
];

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'score_asc' | 'score_desc' | 'updated_desc' | 'issues_desc' | 'checked_desc';

const SORT_LABELS: Record<SortKey, string> = {
  score_asc: 'Score: Worst First',
  score_desc: 'Score: Best First',
  updated_desc: 'Recently Updated',
  issues_desc: 'Most Issues',
  checked_desc: 'Recently Checked',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'never';
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const w = Math.floor(d / 7);
  const mo = Math.floor(d / 30);
  if (mo > 0) return `${mo}mo ago`;
  if (w > 0) return `${w}w ago`;
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-slate-200';
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-amber-400';
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

function detectIssues(d: RevalidationQueueDraft): IssueKey[] {
  const issues: IssueKey[] = [];
  const r = d.latestReport;

  if (d.integrity_status === 'outdated' || d.revalidation_required) {
    issues.push('outdated');
  }
  if (d.drift_deepened_at || (r && r.drift_score !== null && r.drift_score < 70)) {
    issues.push('drift');
  }
  if (
    d.integrity_status === 'failed_validation' ||
    (d.integrity_score !== null && d.integrity_score < 50)
  ) {
    issues.push('failed');
  }
  if (r && r.screenshot_score !== null && r.screenshot_score < 60) {
    issues.push('no_hero');
  }
  if (r && r.narration_score !== null && r.narration_score < 60) {
    issues.push('no_narration');
  }
  if (r && r.caption_score !== null && r.caption_score < 60) {
    issues.push('no_captions');
  }
  if (
    d.integrity_status === 'needs_recapture' ||
    (r && r.capture_score !== null && r.capture_score < 40)
  ) {
    issues.push('recapture');
  }

  return [...new Set(issues)];
}

// ─── Issue Stats Card ─────────────────────────────────────────────────────────

function IssueStatCard({
  def,
  count,
  total,
  isActive,
  onClick,
}: {
  def: IssueDef;
  count: number;
  total: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-40 p-3.5 rounded-xl border text-left transition-all ${
        isActive
          ? `${def.cardBg} ${def.cardBorder} ring-2 ring-offset-1 ring-current ${def.cardText} shadow-sm`
          : `bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm`
      }`}
    >
      <div className={`flex items-center justify-between mb-2`}>
        <def.Icon className={`w-4 h-4 ${isActive ? def.cardText : 'text-slate-400'}`} />
        {count > 0 && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${def.badgeCls}`}>
            {pct}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold tabular-nums leading-none mb-1 ${isActive ? def.cardText : 'text-slate-700'}`}>
        {count}
      </p>
      <p className={`text-[11px] leading-snug ${isActive ? def.cardText : 'text-slate-500'}`}>
        {def.shortLabel}
      </p>
      {count > 0 && (
        <div className="mt-2 h-0.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${def.dotCls}`}
            style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
          />
        </div>
      )}
    </button>
  );
}

// ─── Category Score Bar ───────────────────────────────────────────────────────

function CatScoreBar({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ${scoreTextColor(score)}`}>
          {score !== null ? score : '–'}
        </span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${scoreColor(score)}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
    </div>
  );
}

// ─── Row Expanded Detail ──────────────────────────────────────────────────────

function ExpandedDetail({ draft }: { draft: RevalidationQueueDraft }) {
  const r = draft.latestReport;
  const warnings: string[] = Array.isArray(r?.warnings_json) ? (r?.warnings_json as string[]) : [];
  const failures: string[] = Array.isArray(r?.failures_json) ? (r?.failures_json as string[]) : [];

  return (
    <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-100">
      {!r ? (
        <p className="text-xs text-slate-400 italic py-2">
          No integrity report found. Run a check to see category scores.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-x-4 gap-y-3 pt-2">
            {CAT_SCORES.map(({ key, label }) => (
              <CatScoreBar key={key} label={label} score={r[key] as number | null} />
            ))}
          </div>

          {(failures.length > 0 || warnings.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {failures.length > 0 && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
                    <ShieldX className="w-3 h-3" /> Failures ({failures.length})
                  </p>
                  <ul className="space-y-0.5">
                    {failures.slice(0, 6).map((f, i) => (
                      <li key={i} className="text-[11px] text-red-600">• {f}</li>
                    ))}
                    {failures.length > 6 && (
                      <li className="text-[10px] text-red-400">+{failures.length - 6} more…</li>
                    )}
                  </ul>
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Warnings ({warnings.length})
                  </p>
                  <ul className="space-y-0.5">
                    {warnings.slice(0, 6).map((w, i) => (
                      <li key={i} className="text-[11px] text-amber-700">• {w}</li>
                    ))}
                    {warnings.length > 6 && (
                      <li className="text-[10px] text-amber-400">+{warnings.length - 6} more…</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            Last checked {relativeTime(r.last_checked_at)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Queue Row ────────────────────────────────────────────────────────────────

function QueueRow({
  draft,
  issues,
  onOpen,
  onRunCheck,
  isRunning,
}: {
  draft: RevalidationQueueDraft;
  issues: IssueKey[];
  onOpen?: (id: string) => void;
  onRunCheck: (id: string) => void;
  isRunning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const markValidated = useMarkDraftValidated();
  const requestRecapture = useRequestRecapture();
  const resolveDrift = useResolveDrift();
  const { showToast } = useToast();

  const score = draft.integrity_score;
  const r = draft.latestReport;

  const miniScores = [
    { label: 'Capture', val: r?.capture_score ?? null },
    { label: 'Narration', val: r?.narration_score ?? null },
    { label: 'Captions', val: r?.caption_score ?? null },
  ];

  function handleAction(action: 'validate' | 'recapture' | 'resolve_drift') {
    setShowActions(false);
    if (action === 'validate') {
      markValidated.mutate({ draft_id: draft.id }, {
        onSuccess: () => showToast('Marked as validated', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      });
    } else if (action === 'recapture') {
      requestRecapture.mutate({ draft_id: draft.id }, {
        onSuccess: () => showToast('Recapture requested', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      });
    } else {
      resolveDrift.mutate({ draft_id: draft.id }, {
        onSuccess: () => showToast('Drift resolved', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      });
    }
  }

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer group"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Expand toggle */}
        <button
          className="flex-shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Title + issue badges */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-slate-700 truncate leading-snug">
            {draft.title || 'Untitled Draft'}
          </p>
          <div className="flex items-center flex-wrap gap-1">
            {issues.map((key) => {
              const def = ISSUE_DEF_MAP.get(key)!;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${def.badgeCls}`}
                >
                  <def.Icon className="w-2.5 h-2.5" />
                  {def.shortLabel}
                </span>
              );
            })}
            {issues.length === 0 && (
              <span className="text-[10px] text-slate-400 italic">No issues detected</span>
            )}
          </div>
        </div>

        {/* Mini category dots */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          {miniScores.map(({ label, val }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className={`w-2 h-2 rounded-full ${scoreColor(val)}`} title={`${label}: ${val ?? '–'}`} />
              <span className="text-[9px] text-slate-400">{label.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* Overall score */}
        <div className="w-20 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreColor(score)}`}
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
            <span className={`text-xs font-bold w-7 text-right tabular-nums ${scoreTextColor(score)}`}>
              {score !== null ? score : '–'}
            </span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="hidden md:flex flex-col items-end flex-shrink-0 w-28">
          <span className="text-[11px] text-slate-500 font-medium">
            {relativeTime(r?.last_checked_at)}
          </span>
          <span className="text-[10px] text-slate-400">
            Updated {relativeTime(draft.updated_at)}
          </span>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onRunCheck(draft.id)}
            disabled={isRunning}
            title="Run integrity check"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-40 transition-colors"
          >
            {isRunning
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
          </button>

          {onOpen && (
            <button
              onClick={() => onOpen(draft.id)}
              title="Open draft"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* More actions dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActions((p) => !p)}
              title="More actions"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs">
                <button
                  onClick={() => handleAction('validate')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Mark Validated
                </button>
                <button
                  onClick={() => handleAction('recapture')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-orange-500" />
                  Request Recapture
                </button>
                {issues.includes('drift') && (
                  <button
                    onClick={() => handleAction('resolve_drift')}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                    Resolve Drift
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && <ExpandedDetail draft={draft} />}
    </div>
  );
}

// ─── Summary Header Stats ─────────────────────────────────────────────────────

interface SummaryStats {
  total: number;
  totalWithIssues: number;
  byIssue: Record<IssueKey, number>;
}

function buildStats(drafts: RevalidationQueueDraft[]): SummaryStats {
  const byIssue: Record<IssueKey, number> = {
    outdated: 0, drift: 0, failed: 0, no_hero: 0, no_narration: 0, no_captions: 0, recapture: 0,
  };
  let totalWithIssues = 0;
  for (const d of drafts) {
    const issues = detectIssues(d);
    if (issues.length > 0) totalWithIssues++;
    for (const k of issues) byIssue[k]++;
  }
  return { total: drafts.length, totalWithIssues, byIssue };
}

// ─── RevalidationQueuePage ────────────────────────────────────────────────────

interface RevalidationQueuePageProps {
  onNavigateToDraft?: (draftId: string) => void;
}

export function RevalidationQueuePage({ onNavigateToDraft }: RevalidationQueuePageProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<IssueKey | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('score_asc');
  const [showHealthy, setShowHealthy] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const { data: allDrafts, isLoading, refetch, isFetching } = useRevalidationQueueFull();
  const runCheck = useRunIntegrityCheck();
  const { showToast } = useToast();

  const drafts = useMemo(() => allDrafts ?? [], [allDrafts]);
  const stats = useMemo(() => buildStats(drafts), [drafts]);

  const processed = useMemo(() => {
    let items = drafts.map((d) => ({ draft: d, issues: detectIssues(d) }));

    if (!showHealthy) {
      items = items.filter(({ issues }) => issues.length > 0);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(({ draft }) => draft.title?.toLowerCase().includes(q));
    }
    if (activeFilter !== 'all') {
      items = items.filter(({ issues }) => issues.includes(activeFilter));
    }

    items.sort((a, b) => {
      if (sort === 'score_asc') {
        const sa = a.draft.integrity_score ?? -1;
        const sb = b.draft.integrity_score ?? -1;
        return sa - sb;
      }
      if (sort === 'score_desc') {
        const sa = a.draft.integrity_score ?? 101;
        const sb = b.draft.integrity_score ?? 101;
        return sb - sa;
      }
      if (sort === 'issues_desc') return b.issues.length - a.issues.length;
      if (sort === 'updated_desc') {
        return new Date(b.draft.updated_at).getTime() - new Date(a.draft.updated_at).getTime();
      }
      if (sort === 'checked_desc') {
        const ca = a.draft.latestReport?.last_checked_at ?? '';
        const cb = b.draft.latestReport?.last_checked_at ?? '';
        return new Date(cb).getTime() - new Date(ca).getTime();
      }
      return 0;
    });

    return items;
  }, [drafts, search, activeFilter, sort, showHealthy]);

  function handleRunCheck(draftId: string) {
    setRunningIds((p) => new Set(p).add(draftId));
    runCheck.mutate({ draft_id: draftId }, {
      onSuccess: () => {
        showToast('Integrity check complete', 'success');
        setRunningIds((p) => { const s = new Set(p); s.delete(draftId); return s; });
      },
      onError: (e) => {
        showToast(e.message, 'error');
        setRunningIds((p) => { const s = new Set(p); s.delete(draftId); return s; });
      },
    });
  }

  function handleBatchRevalidate() {
    const targets = processed.filter(({ draft }) => !runningIds.has(draft.id));
    if (targets.length === 0) return;
    showToast(`Running checks on ${targets.length} tutorial${targets.length !== 1 ? 's' : ''}…`, 'info');
    for (const { draft } of targets.slice(0, 10)) {
      handleRunCheck(draft.id);
    }
    if (targets.length > 10) {
      showToast('Batch limit: 10 at a time to avoid rate limits.', 'info');
    }
  }

  const allClear = !isLoading && stats.totalWithIssues === 0;
  const unknownCount = drafts.filter((d) => !d.integrity_status || d.integrity_status === 'unknown').length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Revalidation Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tutorials needing attention — outdated content, drift, missing assets, or low integrity scores.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          {processed.length > 0 && (
            <button
              onClick={handleBatchRevalidate}
              disabled={runningIds.size > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Batch Check ({Math.min(processed.length, 10)})
            </button>
          )}
        </div>
      </div>

      {/* ── All Clear ────────────────────────────────────────────────── */}
      {allClear && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-slate-100 rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">All Tutorials Healthy</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            No revalidation issues detected across {stats.total} tutorial{stats.total !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {/* ── Issue Stat Cards (horizontal scroll) ─────────────────────── */}
      {!allClear && (
        <>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {/* "All Issues" card */}
            <button
              onClick={() => setActiveFilter('all')}
              className={`relative flex-shrink-0 w-36 p-3.5 rounded-xl border text-left transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-800 border-slate-700 text-white ring-2 ring-offset-1 ring-slate-600 shadow-sm'
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              <ShieldAlert className={`w-4 h-4 mb-2 ${activeFilter === 'all' ? 'text-white' : 'text-slate-400'}`} />
              <p className={`text-2xl font-bold tabular-nums leading-none mb-1 ${activeFilter === 'all' ? 'text-white' : 'text-slate-700'}`}>
                {stats.totalWithIssues}
              </p>
              <p className={`text-[11px] ${activeFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                All Issues
              </p>
            </button>

            {ISSUE_DEFS.map((def) => (
              <IssueStatCard
                key={def.key}
                def={def}
                count={stats.byIssue[def.key]}
                total={stats.totalWithIssues}
                isActive={activeFilter === def.key}
                onClick={() => setActiveFilter(activeFilter === def.key ? 'all' : def.key)}
              />
            ))}
          </div>

          {/* Unknown count notice */}
          {unknownCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>
                <strong>{unknownCount}</strong> tutorial{unknownCount !== 1 ? 's have' : ' has'} never been
                checked. Run a batch check to populate their integrity scores.
              </span>
              <button
                onClick={handleBatchRevalidate}
                className="ml-auto flex-shrink-0 text-blue-600 hover:underline font-medium"
              >
                Run Batch Check
              </button>
            </div>
          )}

          {/* ── Toolbar ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tutorials…"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white text-slate-600"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>

            <button
              onClick={() => setShowHealthy((p) => !p)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors ${
                showHealthy
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {showHealthy ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showHealthy ? 'Hiding healthy' : 'Show all'}
            </button>
          </div>

          {/* ── Table Header ─────────────────────────────────────────── */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="hidden md:grid grid-cols-[1.5rem_1fr_5rem_8rem_3rem_7rem] gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              <div />
              <div>Tutorial</div>
              <div className="text-right">Score</div>
              <div className="hidden lg:block">Mini Scores</div>
              <div className="hidden lg:block" />
              <div className="text-right">Checked</div>
            </div>

            {/* ── Loading ──────────────────────────────────────────── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : processed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <ShieldCheck className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-400">
                  {search || activeFilter !== 'all' ? 'No tutorials match your filters' : 'No issues found'}
                </p>
                {(search || activeFilter !== 'all') && (
                  <button
                    onClick={() => { setSearch(''); setActiveFilter('all'); }}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div>
                {processed.map(({ draft, issues }) => (
                  <QueueRow
                    key={draft.id}
                    draft={draft}
                    issues={issues}
                    onOpen={onNavigateToDraft}
                    onRunCheck={handleRunCheck}
                    isRunning={runningIds.has(draft.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer count ─────────────────────────────────────────── */}
          {processed.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>
                Showing <strong className="text-slate-600">{processed.length}</strong> of{' '}
                <strong className="text-slate-600">{drafts.length}</strong> tutorials
              </span>
              <span>
                {stats.totalWithIssues} need attention &mdash; {stats.total - stats.totalWithIssues} healthy
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

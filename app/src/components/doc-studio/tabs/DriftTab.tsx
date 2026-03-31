import { useState } from 'react';
import { RefreshCw, Loader as Loader2, ShieldCheck, ShieldAlert, ShieldX, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle } from 'lucide-react';
import {
  useDriftChecks,
  useDriftSummary,
  useRunDriftCheck,
  useMarkDriftValidated,
  useMarkAllDriftValidated,
} from '../../../hooks/useDocStudioQuality';
import { useToast } from '../../../lib/toast';
import type { DriftStatus, DriftSeverity, DocStudioDriftCheck } from '../../../types/documentation';

const DRIFT_STATUS_CONFIG: Record<DriftStatus, { label: string; icon: React.ReactElement; color: string; bg: string; border: string }> = {
  current: {
    label: 'Current',
    icon: <ShieldCheck size={14} className="text-green-600" />,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
  warning: {
    label: 'Warning',
    icon: <ShieldAlert size={14} className="text-amber-500" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  outdated: {
    label: 'Outdated',
    icon: <ShieldX size={14} className="text-red-500" />,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
  unknown: {
    label: 'Unknown',
    icon: <ShieldCheck size={14} className="text-slate-400" />,
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-100',
  },
};

const SEVERITY_COLORS: Record<DriftSeverity, string> = {
  none: 'text-slate-400',
  low: 'text-blue-500',
  medium: 'text-amber-500',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

const SEVERITY_DOT: Record<DriftSeverity, string> = {
  none: 'bg-slate-200',
  low: 'bg-blue-400',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

type DriftFilter = 'all' | 'current' | 'warning' | 'outdated' | 'unknown';

function relativeTime(dateStr: string): string {
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

function DriftCheckCard({
  check,
  onValidate,
  validating,
}: {
  check: DocStudioDriftCheck;
  draftId: string;
  onValidate: (checkId: string) => void;
  validating: boolean;
}) {
  const cfg = DRIFT_STATUS_CONFIG[check.drift_status] ?? DRIFT_STATUS_CONFIG.unknown;
  const isValidated = !!check.validated_at;

  return (
    <div className={`bg-white border rounded-xl p-4 ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {check.severity !== 'none' && (
              <span className={`flex items-center gap-1 text-xs font-medium capitalize ${SEVERITY_COLORS[check.severity]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[check.severity]}`} />
                {check.severity}
              </span>
            )}
            {isValidated && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={10} /> Validated
              </span>
            )}
          </div>
          {check.reason && (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{check.reason}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            {check.checked_at && (
              <span title={new Date(check.checked_at).toLocaleString()}>Checked {relativeTime(check.checked_at)}</span>
            )}
            {isValidated && check.validated_at && (
              <span title={new Date(check.validated_at).toLocaleString()}>Validated {relativeTime(check.validated_at)}</span>
            )}
          </div>
        </div>
        {!isValidated && check.drift_status !== 'current' && (
          <button
            onClick={() => onValidate(check.id)}
            disabled={validating}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {validating ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
            Validate
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  draftId: string;
}

export function DriftTab({ draftId }: Props) {
  const { showToast } = useToast();
  const { data: checks = [], isLoading: checksLoading, refetch } = useDriftChecks(draftId);
  const { data: summary, isLoading: summaryLoading } = useDriftSummary(draftId);
  const runCheck = useRunDriftCheck();
  const markValidated = useMarkDriftValidated();
  const markAllValidated = useMarkAllDriftValidated();

  const [filter, setFilter] = useState<DriftFilter>('all');
  const [confirmBulk, setConfirmBulk] = useState(false);

  const handleRunCheck = async () => {
    try {
      await runCheck.mutateAsync(draftId);
      showToast('Drift check complete', 'success');
    } catch {
      showToast('Drift check failed', 'error');
    }
  };

  const handleValidate = async (checkId: string) => {
    try {
      await markValidated.mutateAsync({ check_id: checkId, draft_id: draftId });
      showToast('Marked as validated', 'success');
    } catch {
      showToast('Failed to validate', 'error');
    }
  };

  const handleValidateAll = async () => {
    setConfirmBulk(false);
    try {
      await markAllValidated.mutateAsync({ draft_id: draftId });
      showToast('All drift checks validated', 'success');
    } catch {
      showToast('Failed to validate all', 'error');
    }
  };

  const filtered = filter === 'all' ? checks : checks.filter((c) => c.drift_status === filter);
  const isLoading = checksLoading || summaryLoading;
  const outdatedCount = summary?.outdated_count ?? 0;
  const warningCount = summary?.warning_count ?? 0;
  const needsAction = outdatedCount + warningCount;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Screenshot Drift</span>
          {summary && (
            <span className="text-xs text-slate-400">
              {summary.current_count}/{summary.total} current
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {needsAction > 0 && !confirmBulk && (
            <button
              onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
            >
              <CheckCircle size={13} />
              Validate All
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={handleRunCheck}
            disabled={runCheck.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {runCheck.isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
            Run Check
          </button>
        </div>
      </div>

      {confirmBulk && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle size={15} />
            <span>This will mark all {needsAction} drift issue{needsAction !== 1 ? 's' : ''} as validated. Continue?</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setConfirmBulk(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Cancel</button>
            <button
              onClick={handleValidateAll}
              disabled={markAllValidated.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {markAllValidated.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
              Confirm
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {([
            { label: 'Total', value: summary.total, color: 'text-slate-700', filterKey: 'all' as DriftFilter },
            { label: 'Current', value: summary.current_count, color: 'text-green-600', filterKey: 'current' as DriftFilter },
            { label: 'Warning', value: summary.warning_count, color: 'text-amber-600', filterKey: 'warning' as DriftFilter },
            { label: 'Outdated', value: summary.outdated_count, color: 'text-red-600', filterKey: 'outdated' as DriftFilter },
          ]).map(({ label, value, color, filterKey }) => (
            <button
              key={label}
              onClick={() => setFilter(filterKey)}
              className={`bg-white border rounded-xl p-3 text-center transition-all hover:shadow-sm ${
                filter === filterKey ? 'border-blue-400 ring-1 ring-blue-300' : 'border-slate-200'
              }`}
            >
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </button>
          ))}
        </div>
      )}

      {checks.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'current', 'warning', 'outdated', 'unknown'] as DriftFilter[]).map((f) => {
            const count = f === 'all' ? checks.length : checks.filter((c) => c.drift_status === f).length;
            if (count === 0 && f !== 'all') return null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors capitalize ${
                  filter === f
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f} {f !== 'all' && `(${count})`}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          {checks.length === 0
            ? 'No drift checks yet. Run a check to detect outdated screenshots.'
            : `No ${filter} drift checks.`}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((check) => (
            <DriftCheckCard
              key={check.id}
              check={check}
              draftId={draftId}
              onValidate={handleValidate}
              validating={markValidated.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

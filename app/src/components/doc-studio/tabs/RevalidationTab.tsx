import { useState } from 'react';
import { History, Loader as Loader2, ShieldCheck, ShieldAlert, ShieldX, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Clock, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import {
  useDocStudioRevalidationEvents,
  useDocStudioIntegrityHistory,
} from '../../../hooks/useDocStudioIntegrity';
import type {
  RevalidationEvent,
  TutorialIntegrityReport,
  RevalidationEventType,
  IntegrityStatus,
  RevalidationOutcome,
} from '../../../types/documentation';
import {
  INTEGRITY_STATUS_LABELS,
  INTEGRITY_STATUS_COLORS,
  REVALIDATION_EVENT_TYPE_LABELS,
} from '../../../types/documentation';

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_ICON: Record<RevalidationEventType, React.ReactElement> = {
  integrity_check_started: <RefreshCw size={12} className="text-blue-500" />,
  integrity_check_completed: <CheckCircle2 size={12} className="text-green-500" />,
  integrity_warning_raised: <AlertTriangle size={12} className="text-amber-500" />,
  integrity_failure_raised: <XCircle size={12} className="text-red-500" />,
  tutorial_marked_validated: <ShieldCheck size={12} className="text-green-600" />,
  tutorial_marked_outdated: <ShieldX size={12} className="text-rose-500" />,
  revalidation_requested: <ShieldAlert size={12} className="text-amber-600" />,
  recapture_requested: <ShieldX size={12} className="text-orange-600" />,
  shot_plan_generated: <CheckCircle2 size={12} className="text-blue-500" />,
  shot_plan_updated: <CheckCircle2 size={12} className="text-blue-400" />,
  drift_detected: <AlertTriangle size={12} className="text-rose-500" />,
  drift_resolved: <ShieldCheck size={12} className="text-blue-500" />,
};

const OUTCOME_CONFIG: Record<RevalidationOutcome, { label: string; className: string }> = {
  success: { label: 'Success', className: 'bg-green-100 text-green-700' },
  failure: { label: 'Failure', className: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  skipped: { label: 'Skipped', className: 'bg-slate-100 text-slate-500' },
};

const STATUS_SMALL_ICON: Record<IntegrityStatus, React.ReactElement> = {
  unknown: <ShieldCheck size={11} className="text-slate-400" />,
  healthy: <ShieldCheck size={11} className="text-green-500" />,
  warning: <ShieldAlert size={11} className="text-amber-500" />,
  needs_review: <ShieldAlert size={11} className="text-orange-500" />,
  needs_recapture: <ShieldX size={11} className="text-red-500" />,
  outdated: <ShieldX size={11} className="text-rose-500" />,
  incomplete: <ShieldX size={11} className="text-yellow-500" />,
  failed_validation: <ShieldX size={11} className="text-red-700" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

// ─── EventRow ─────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: RevalidationEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = event.notes || (Object.keys(event.detail_json ?? {}).length > 0);

  return (
    <div className="border-b border-slate-50 last:border-0">
      <button
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={`flex items-start gap-3 w-full text-left py-2.5 px-1 ${hasDetail ? 'hover:bg-slate-50' : ''} rounded transition-colors`}
      >
        <div className="flex-shrink-0 mt-0.5 w-5 flex justify-center">
          {EVENT_TYPE_ICON[event.event_type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-700">
              {REVALIDATION_EVENT_TYPE_LABELS[event.event_type]}
            </span>
            {event.outcome && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${OUTCOME_CONFIG[event.outcome].className}`}>
                {OUTCOME_CONFIG[event.outcome].label}
              </span>
            )}
          </div>
          {event.notes && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{event.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {relativeTime(event.created_at)}
          </span>
          {hasDetail && (
            expanded ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />
          )}
        </div>
      </button>
      {expanded && hasDetail && (
        <div className="pl-9 pb-2.5 pr-1">
          {event.notes && (
            <p className="text-xs text-slate-600 mb-2">{event.notes}</p>
          )}
          {Object.keys(event.detail_json ?? {}).length > 0 && (
            <pre className="text-[10px] bg-slate-50 border border-slate-100 rounded-lg p-2.5 overflow-x-auto text-slate-500 leading-relaxed">
              {JSON.stringify(event.detail_json, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HistoryRow ───────────────────────────────────────────────────────────────

function HistoryRow({ report }: { report: TutorialIntegrityReport }) {
  const [expanded, setExpanded] = useState(false);
  const status = report.overall_status;
  const failures = report.failures_json ?? [];
  const warnings = report.warnings_json ?? [];

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-3 w-full text-left p-3 hover:bg-slate-50 transition-colors"
      >
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${INTEGRITY_STATUS_COLORS[status]}`}>
          {STATUS_SMALL_ICON[status]}
          {INTEGRITY_STATUS_LABELS[status]}
        </div>
        <span className="text-xs font-semibold text-slate-700">{Math.round(report.overall_score)}/100</span>
        {failures.length > 0 && (
          <span className="text-[10px] text-red-600">{failures.length} failure{failures.length !== 1 ? 's' : ''}</span>
        )}
        {warnings.length > 0 && (
          <span className="text-[10px] text-amber-600">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
        )}
        <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
          <Clock size={10} />
          {formatDateTime(report.last_checked_at)}
        </span>
        {expanded ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-3 py-2.5 bg-slate-50 space-y-1.5">
          {/* Category scores */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {(
              [
                ['capture', report.capture_integrity_score],
                ['content', report.content_integrity_score],
                ['narration', report.narration_integrity_score],
                ['screenshot', report.screenshot_integrity_score],
                ['scene', report.scene_integrity_score],
                ['shot_plan', report.shot_plan_integrity_score],
                ['caption', report.caption_integrity_score],
                ['render', report.render_integrity_score],
                ['drift', report.drift_integrity_score],
              ] as [string, number | null][]
            ).map(([cat, score]) => (
              <div key={cat} className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 capitalize">{cat.replace('_', ' ')}</span>
                <span className={`font-semibold ${score !== null && score >= 90 ? 'text-green-600' : score !== null && score >= 75 ? 'text-amber-600' : score !== null ? 'text-red-500' : 'text-slate-400'}`}>
                  {score !== null ? Math.round(score) : '–'}
                </span>
              </div>
            ))}
          </div>
          {report.check_duration_ms != null && (
            <p className="text-[10px] text-slate-400 pt-1">Check took {report.check_duration_ms}ms · engine v{report.engine_version}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RevalidationTab ──────────────────────────────────────────────────────────

interface RevalidationTabProps {
  draftId: string;
}

type ActiveView = 'events' | 'history';

export function RevalidationTab({ draftId }: RevalidationTabProps) {
  const [view, setView] = useState<ActiveView>('events');

  const { data: events, isLoading: eventsLoading } = useDocStudioRevalidationEvents(draftId, 50);
  const { data: history, isLoading: historyLoading } = useDocStudioIntegrityHistory(draftId, 20);

  const isLoading = view === 'events' ? eventsLoading : historyLoading;

  return (
    <div className="p-5 space-y-4">

      {/* View switcher */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('events')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            view === 'events' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History size={12} />
          Event Log
          {events && events.length > 0 && (
            <span className="bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {events.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            view === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck size={12} />
          Check History
          {history && history.length > 0 && (
            <span className="bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-slate-400" />
        </div>
      ) : view === 'events' ? (
        <>
          {!events || events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History size={24} className="text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No events recorded yet</p>
              <p className="text-xs text-slate-300 mt-1">Events are logged when integrity checks run or manual actions are taken.</p>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-xl divide-y-0 overflow-hidden">
              {(events as RevalidationEvent[]).map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {!history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck size={24} className="text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No check history yet</p>
              <p className="text-xs text-slate-300 mt-1">Past integrity reports will appear here after running checks.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(history as TutorialIntegrityReport[]).map((r) => (
                <HistoryRow key={r.id} report={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ArrowLeft, RefreshCw, Ban, ChevronRight, ChevronDown, CircleCheck as CheckCircle, Circle as XCircle, Clock, CircleAlert as AlertCircle, Camera, Loader as Loader2, Play, Copy, RotateCw, Activity, Timer, Zap, Code as Code2, TriangleAlert as AlertTriangle, ImageOff, FileText, Mic } from 'lucide-react';
import { useDocStudioJob, useDocStudioJobEvents, useCancelJob, useCompleteJob, useJobAssets } from '../../hooks/useDocStudioJobs';
import { usePlaywrightSettings } from '../../hooks/useDocStudioSettings';
import { useGenerateContent, useGenerateNarration, useElevenLabsAvailable } from '../../hooks/useDocStudio';
import { useToast } from '../../lib/toast';
import { isSafeExternalUrl } from '../../lib/browser';
import type {
  DocumentationJobEvent,
  JobStatus,
  StepExecutionResult,
  RetryAttemptLog,
  DocumentationAsset,
  RichExecutionSummary,
} from '../../types/documentation';
import { JOB_STATUS_LABELS, ACTIVE_JOB_STATUSES } from '../../types/documentation';

// ─── Style maps ──────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

const STATUS_BADGE: Record<JobStatus, string> = {
  queued: 'bg-slate-100 text-slate-600',
  preparing: 'bg-blue-100 text-blue-700',
  running: 'bg-blue-100 text-blue-700',
  capturing: 'bg-amber-100 text-amber-700',
  scene_assembly: 'bg-indigo-100 text-indigo-700',
  generating_content: 'bg-sky-100 text-sky-700',
  generating_narration: 'bg-violet-100 text-violet-700',
  quality_scoring: 'bg-teal-100 text-teal-700',
  ready_for_review: 'bg-emerald-100 text-emerald-700',
  needs_manual_step: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const PHASE_PROGRESS: Record<JobStatus, number> = {
  queued: 5,
  preparing: 15,
  running: 30,
  capturing: 60,
  scene_assembly: 70,
  generating_content: 80,
  generating_narration: 88,
  quality_scoring: 95,
  ready_for_review: 100,
  needs_manual_step: 60,
  completed: 100,
  failed: 100,
  cancelled: 100,
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function copyToClipboard(text: string, showToast: (msg: string, type: 'success' | 'error') => void) {
  navigator.clipboard.writeText(text).then(
    () => showToast('Copied to clipboard', 'success'),
    () => showToast('Copy failed', 'error'),
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RetryAttemptRow({
  log,
  assets,
}: {
  log: RetryAttemptLog;
  assets: DocumentationAsset[];
}) {
  const failureAsset = log.failure_screenshot_asset_id
    ? assets.find((a) => a.id === log.failure_screenshot_asset_id)
    : null;
  const safeFailureAssetUrl = failureAsset?.file_url && isSafeExternalUrl(failureAsset.file_url) ? failureAsset.file_url : null;

  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-red-600">Attempt {log.attempt}</span>
        <span className="text-xs text-slate-400 font-mono">{formatMs(log.duration_ms)}</span>
        {log.strategy_tried && (
          <span className="text-xs px-1.5 py-0.5 bg-white border border-red-200 rounded text-red-500 font-mono">
            {log.strategy_tried}
          </span>
        )}
      </div>
      {log.selector_tried && (
        <p className="text-xs font-mono text-slate-500 truncate">
          <span className="text-slate-400">selector: </span>{log.selector_tried}
        </p>
      )}
      <p className="text-xs text-red-600">{log.error}</p>
      {safeFailureAssetUrl && (
        <a
          href={safeFailureAssetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1.5"
        >
          <img
            src={safeFailureAssetUrl}
            alt={`Failure attempt ${log.attempt}`}
            className="w-full max-h-32 object-cover rounded border border-red-200"
          />
        </a>
      )}
    </div>
  );
}

type StepFilter = 'all' | 'failed' | 'retried';

function StepResultRow({
  result,
  assets,
  showToast,
}: {
  result: StepExecutionResult;
  assets: DocumentationAsset[];
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const stepAssets = assets.filter(
    (a) => a.step_id === result.step_id && a.asset_type === 'screenshot',
  );
  const hasDetail =
    !!result.error ||
    !!result.extracted_text ||
    !!result.selector_used ||
    (result.retry_log?.length ?? 0) > 0 ||
    stepAssets.length > 0;

  const statusIcon =
    result.status === 'success' ? (
      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
    ) : result.status === 'failed' ? (
      <XCircle size={14} className="text-red-500 flex-shrink-0" />
    ) : result.status === 'skipped' ? (
      <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
    ) : (
      <Clock size={14} className="text-slate-400 flex-shrink-0" />
    );

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        className="w-full flex items-start gap-3 py-2.5 px-1 text-left hover:bg-slate-50 rounded transition-colors"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
      >
        <span className="mt-0.5">{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-700">
              {result.step_order}. {result.title}
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 font-mono rounded">
              {result.action_type}
            </span>
            {result.retry_attempts > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <RotateCw size={10} />
                {result.retry_attempts}
              </span>
            )}
            {result.used_fallback && (
              <span className="text-xs text-sky-500 font-mono">fallback</span>
            )}
          </div>
          {result.error && !expanded && (
            <p className="text-xs text-red-500 mt-0.5 truncate">{result.error}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400">{formatMs(result.duration_ms)}</span>
          {hasDetail && (
            expanded
              ? <ChevronDown size={13} className="text-slate-400" />
              : <ChevronRight size={13} className="text-slate-400" />
          )}
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="pl-7 pb-3 space-y-3">
          {result.selector_used && (
            <div className="text-xs space-y-0.5">
              <p className="text-slate-400 font-medium">Selector</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-100 text-slate-600 rounded px-2 py-1 font-mono truncate">
                  {result.selector_used}
                </code>
                {result.selector_strategy_used && (
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-xs">
                    {result.selector_strategy_used}
                  </span>
                )}
              </div>
            </div>
          )}

          {result.extracted_text && (
            <div className="text-xs space-y-0.5">
              <p className="text-slate-400 font-medium">Extracted Text</p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 bg-slate-100 text-slate-600 rounded px-2 py-1 font-mono whitespace-pre-wrap text-xs max-h-24 overflow-y-auto">
                  {result.extracted_text}
                </pre>
                <button
                  onClick={() => copyToClipboard(result.extracted_text!, showToast)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          )}

          {result.error && (
            <div className="text-xs space-y-0.5">
              <p className="text-slate-400 font-medium">Error</p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 bg-red-50 text-red-600 rounded px-2 py-1 font-mono whitespace-pre-wrap text-xs max-h-24 overflow-y-auto border border-red-100">
                  {result.error}
                </pre>
                <button
                  onClick={() => copyToClipboard(result.error!, showToast)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          )}

          {(result.retry_log?.length ?? 0) > 0 && (
            <div className="text-xs space-y-1.5">
              <p className="text-slate-400 font-medium">Retry Log</p>
              <div className="space-y-2">
                {result.retry_log!.map((log) => (
                  <RetryAttemptRow key={log.attempt} log={log} assets={assets} />
                ))}
              </div>
            </div>
          )}

          {stepAssets.length > 0 && (
            <div className="text-xs space-y-1.5">
              <p className="text-slate-400 font-medium">Checkpoint Screenshot</p>
              <div className="grid grid-cols-2 gap-2">
                {stepAssets.map((a) => {
                  const safeAssetUrl = isSafeExternalUrl(a.file_url) ? a.file_url : null;
                  return safeAssetUrl ? (
                    <a
                      key={a.id}
                      href={safeAssetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded border border-slate-200 overflow-hidden hover:border-blue-300"
                    >
                      <img src={safeAssetUrl} alt={a.caption ?? 'screenshot'} loading="lazy" decoding="async" className="w-full h-20 object-cover" />
                    </a>
                  ) : (
                    <div key={a.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-4 text-center text-[11px] text-slate-500">
                      Preview unavailable
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-4 text-xs text-slate-400">
            <span>Started: {result.started_at ? formatDate(result.started_at) : '—'}</span>
            <span>Ended: {result.completed_at ? formatDate(result.completed_at) : '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: DocumentationJobEvent }) {
  const dot = SEVERITY_DOT[event.severity] ?? 'bg-slate-400';
  return (
    <div className="flex gap-3 py-2">
      <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="w-px flex-1 bg-slate-200" />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-700">{event.title ?? event.event_type}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${SEVERITY_STYLES[event.severity]}`}>
            {event.severity}
          </span>
          {event.duration_ms != null && (
            <span className="text-xs text-slate-400 font-mono">{formatMs(event.duration_ms)}</span>
          )}
        </div>
        {event.description && <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>}
        <span className="text-xs text-slate-400">{formatDate(event.created_at)}</span>
      </div>
    </div>
  );
}

function SummaryStatRow({ summary }: { summary: RichExecutionSummary }) {
  const stats = [
    {
      icon: <RotateCw size={12} />,
      label: 'Retries',
      value: summary.total_retry_count.toString(),
      warn: summary.total_retry_count > 0,
    },
    {
      icon: <Zap size={12} />,
      label: 'Fallbacks',
      value: summary.fallback_used_count.toString(),
      warn: summary.fallback_used_count > 0,
    },
    {
      icon: <ImageOff size={12} />,
      label: 'Fail Shots',
      value: summary.failure_screenshot_count.toString(),
      warn: summary.failure_screenshot_count > 0,
    },
    {
      icon: <Activity size={12} />,
      label: 'Auth',
      value: summary.auth_duration_ms ? formatMs(summary.auth_duration_ms) : '—',
      warn: false,
    },
    {
      icon: <Timer size={12} />,
      label: 'Slowest',
      value: summary.slowest_step
        ? `${summary.slowest_step.step_order}. ${formatMs(summary.slowest_step.duration_ms)}`
        : '—',
      warn: false,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
            s.warn && s.value !== '0'
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <span className="text-slate-400">{s.icon}</span>
          <span className="text-slate-400">{s.label}:</span>
          <span className="font-semibold">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function DebugAccordion({ job }: { job: { execution_summary_json: unknown; step_results_json: unknown; logs_json: unknown } }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'summary' | 'steps' | 'logs'>('summary');

  const data =
    tab === 'summary' ? job.execution_summary_json
    : tab === 'steps' ? job.step_results_json
    : job.logs_json;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Debug JSON</span>
        </div>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <div className="flex border-b border-slate-100">
            {(['summary', 'steps', 'logs'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'summary' ? 'Execution Summary' : t === 'steps' ? 'Step Results' : 'Logs'}
              </button>
            ))}
          </div>
          <pre className="p-4 text-xs font-mono text-slate-600 overflow-auto max-h-80 bg-slate-50 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  jobId: string;
  onBack: () => void;
  onOpenDraft?: (draftId: string) => void;
}

export function JobDetail({ jobId, onBack, onOpenDraft }: Props) {
  const { showToast } = useToast();
  const { data: settings } = usePlaywrightSettings();
  const { data: job, isLoading: jobLoading, refetch } = useDocStudioJob(jobId);
  const { data: events = [], isLoading: eventsLoading } = useDocStudioJobEvents(jobId);
  const { data: assets = [] } = useJobAssets(jobId);

  const cancelJob = useCancelJob(settings ?? null);
  const completeJob = useCompleteJob();
  const generateContent = useGenerateContent();
  const generateNarration = useGenerateNarration();
  const { data: elevenLabsAvailable } = useElevenLabsAvailable();

  const [stepFilter, setStepFilter] = useState<StepFilter>('all');

  const handleGenerateContent = async () => {
    if (!job?.draft_id || !job?.organization_id) return;
    try {
      await generateContent.mutateAsync({
        jobId,
        draftId: job.draft_id,
        organizationId: job.organization_id,
      });
      showToast('Content generated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Content generation failed', 'error');
    }
  };

  const handleGenerateNarration = async () => {
    if (!job?.draft_id || !job?.organization_id) return;
    try {
      await generateNarration.mutateAsync({
        draftId: job.draft_id,
        organizationId: job.organization_id,
      });
      showToast('Narration audio generated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Narration generation failed', 'error');
    }
  };

  const isActive = job ? ACTIVE_JOB_STATUSES.includes(job.status) : false;

  const handleCancel = async () => {
    try {
      await cancelJob.mutateAsync(jobId);
      showToast('Job cancelled', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed to cancel job'), 'error');
    }
  };

  const handleMarkComplete = async () => {
    try {
      await completeJob.mutateAsync({ jobId, draftId: job?.draft_id ?? undefined });
      showToast('Job marked as completed', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed to update job'), 'error');
    }
  };

  if (jobLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm">Job not found.</p>
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const stepResults: StepExecutionResult[] = Array.isArray(job.step_results_json)
    ? job.step_results_json
    : [];
  const totalSteps = stepResults.length;
  const completedSteps = stepResults.filter((s) => s.status === 'success').length;
  const failedSteps = stepResults.filter((s) => s.status === 'failed').length;
  const retriedSteps = stepResults.filter((s) => (s.retry_attempts ?? 0) > 0).length;

  const filteredSteps = stepResults.filter((r) => {
    if (stepFilter === 'failed') return r.status === 'failed';
    if (stepFilter === 'retried') return (r.retry_attempts ?? 0) > 0;
    return true;
  });

  const richSummary = (
    typeof job.execution_summary_json === 'object' &&
    job.execution_summary_json !== null &&
    'total_steps' in job.execution_summary_json
  )
    ? (job.execution_summary_json as RichExecutionSummary)
    : null;

  const progressPct = PHASE_PROGRESS[job.status as JobStatus] ?? 0;
  const liveProgress = isActive && totalSteps > 0
    ? Math.round((job.completed_step_count / Math.max(totalSteps, 1)) * 100)
    : null;

  const screenshotAssets = (assets as DocumentationAsset[]).filter(
    (a) => a.asset_type === 'screenshot',
  );
  const failureAssets = (assets as DocumentationAsset[]).filter(
    (a) => a.asset_type === 'failure_screenshot',
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-800 truncate">
              {job.custom_title ?? job.workflow?.name ?? `Job ${job.id.slice(0, 8)}`}
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[job.status as JobStatus]}`}
            >
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              )}
              {JOB_STATUS_LABELS[job.status as JobStatus]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelJob.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              {cancelJob.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Ban size={13} />
              )}
              Cancel
            </button>
          )}
          {job.status === 'ready_for_review' && (
            <button
              onClick={handleMarkComplete}
              disabled={completeJob.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {completeJob.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle size={13} />
              )}
              Mark Complete
            </button>
          )}
          {job.draft_id && onOpenDraft && (
            <button
              onClick={() => onOpenDraft(job.draft_id!)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition-colors"
            >
              Open Draft
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar — active jobs */}
      {isActive && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Play size={11} className="text-blue-500" />
              <span className="font-medium text-slate-700">{JOB_STATUS_LABELS[job.status as JobStatus]}</span>
            </span>
            {totalSteps > 0 ? (
              <span>
                {job.completed_step_count}/{totalSteps} steps
              </span>
            ) : (
              <span>{progressPct}%</span>
            )}
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${liveProgress ?? progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Provider', value: job.provider_mode },
          { label: 'Duration', value: formatDuration(job.duration_seconds) },
          {
            label: 'Steps',
            value: totalSteps > 0 ? `${completedSteps}/${totalSteps}` : '—',
            sub: failedSteps > 0 ? `${failedSteps} failed` : undefined,
            subColor: 'text-red-500',
          },
          { label: 'Assets', value: job.asset_count.toString() },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className="font-semibold text-slate-700 mt-0.5">{card.value}</p>
            {card.sub && (
              <p className={`text-xs mt-0.5 ${card.subColor ?? 'text-slate-400'}`}>{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Rich execution summary stats */}
      {richSummary && <SummaryStatRow summary={richSummary} />}

      {/* AI Actions */}
      {!isActive && job.draft_id && (job.status === 'ready_for_review' || job.status === 'completed') && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-blue-500" />
            <h3 className="font-medium text-slate-700 text-sm">AI Content Pipeline</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateContent}
              disabled={generateContent.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {generateContent.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              {job.content_generated_at ? 'Regenerate Content' : 'Generate Content'}
            </button>

            {job.content_generated_at && (
              <span className="text-xs text-slate-400">
                Last generated {new Date(job.content_generated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {elevenLabsAvailable && job.content_generated_at && (
              <button
                onClick={handleGenerateNarration}
                disabled={generateNarration.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {generateNarration.isPending ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
                {job.narration_generated_at ? 'Regenerate Narration' : 'Generate Narration'}
              </button>
            )}

            {job.narration_generated_at && (
              <span className="text-xs text-slate-400">
                Narration: {new Date(job.narration_generated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {job.error_message && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-700">{job.error_message}</p>
          </div>
          <button
            onClick={() => copyToClipboard(job.error_message!, showToast)}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
          >
            <Copy size={12} />
          </button>
        </div>
      )}

      {/* Events + Steps two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Events timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-medium text-slate-700 text-sm mb-3">Event Timeline</h3>
          {eventsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-blue-400" />
            </div>
          ) : (events as DocumentationJobEvent[]).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No events yet.</p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              {(events as DocumentationJobEvent[]).map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>

        {/* Step results */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium text-slate-700 text-sm">Step Results</h3>
            <div className="flex items-center gap-1 ml-auto">
              {(
                [
                  { id: 'all', label: `All (${totalSteps})` },
                  { id: 'failed', label: `Failed (${failedSteps})` },
                  { id: 'retried', label: `Retried (${retriedSteps})` },
                ] as { id: StepFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStepFilter(tab.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    stepFilter === tab.id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {filteredSteps.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              {totalSteps === 0 ? 'No step results yet.' : 'No steps match this filter.'}
            </p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              {filteredSteps.map((r, i) => (
                <StepResultRow
                  key={i}
                  result={r}
                  assets={assets as DocumentationAsset[]}
                  showToast={showToast}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot assets */}
      {screenshotAssets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-medium text-slate-700 text-sm mb-3">
            Screenshots ({screenshotAssets.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {screenshotAssets.map((asset) => {
              const safeAssetUrl = isSafeExternalUrl(asset.file_url) ? asset.file_url : null;
              return safeAssetUrl ? (
                <a
                  key={asset.id}
                  href={safeAssetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-slate-200 overflow-hidden hover:border-blue-300 transition-colors"
                >
                  <img
                    src={safeAssetUrl}
                    alt={asset.caption ?? 'Screenshot'}
                    className="w-full h-24 object-cover bg-slate-100"
                  />
                  {asset.caption && (
                    <p className="text-xs text-slate-500 p-2 truncate">{asset.caption}</p>
                  )}
                </a>
              ) : (
                <div key={asset.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-6 text-center text-xs text-slate-500">
                  Screenshot unavailable
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Failure screenshots */}
      {failureAssets.length > 0 && (
        <div className="bg-white border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={14} className="text-red-400" />
            <h3 className="font-medium text-slate-700 text-sm">
              Failure Screenshots ({failureAssets.length})
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {failureAssets.map((asset) => {
              const safeAssetUrl = isSafeExternalUrl(asset.file_url) ? asset.file_url : null;
              return safeAssetUrl ? (
                <a
                  key={asset.id}
                  href={safeAssetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-red-200 overflow-hidden hover:border-red-400 transition-colors"
                >
                  <img
                    src={safeAssetUrl}
                    alt={asset.caption ?? 'Failure screenshot'}
                    className="w-full h-24 object-cover bg-red-50"
                  />
                  {asset.caption && (
                    <p className="text-xs text-red-500 p-2 truncate">{asset.caption}</p>
                  )}
                </a>
              ) : (
                <div key={asset.id} className="rounded-lg border border-red-200 bg-red-50 px-2 py-6 text-center text-xs text-red-500">
                  Failure screenshot unavailable
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debug accordion */}
      <DebugAccordion job={job} />
    </div>
  );
}

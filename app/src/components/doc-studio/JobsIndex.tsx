import { useState } from 'react';
import { Loader as Loader2, CircleAlert as AlertCircle, Clock, Play, ChevronRight, RefreshCw } from 'lucide-react';
import { useDocStudioJobs } from '../../hooks/useDocStudioJobs';
import type { JobStatus, DocumentationJob } from '../../types/documentation';
import { JOB_STATUS_LABELS } from '../../types/documentation';

const STATUS_TABS: Array<{ value: JobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'capturing', label: 'Capturing' },
  { value: 'generating_content', label: 'Generating' },
  { value: 'ready_for_review', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'needs_manual_step', label: 'Manual' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<JobStatus, string> = {
  queued: 'bg-slate-100 text-slate-600',
  preparing: 'bg-blue-100 text-blue-700',
  running: 'bg-blue-100 text-blue-700',
  capturing: 'bg-amber-100 text-amber-700',
  scene_assembly: 'bg-indigo-100 text-indigo-700',
  generating_content: 'bg-purple-100 text-purple-700',
  generating_narration: 'bg-violet-100 text-violet-700',
  quality_scoring: 'bg-teal-100 text-teal-700',
  ready_for_review: 'bg-emerald-100 text-emerald-700',
  needs_manual_step: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const ACTIVE_STATUSES: JobStatus[] = ['queued', 'preparing', 'running', 'capturing', 'generating_content'];

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {ACTIVE_STATUSES.includes(status) && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  onViewJob: (jobId: string) => void;
}

export function JobsIndex({ onViewJob }: Props) {
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');

  const { data: jobs = [], isLoading, isError, refetch } = useDocStudioJobs({
    status: statusFilter,
    limit: 100,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Automation Jobs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track the status of all workflow runs.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm">Failed to load jobs.</p>
          <button onClick={() => refetch()} className="text-sm text-blue-600 hover:underline">Retry</button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Play size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No jobs found</p>
          <p className="text-sm mt-1">Run a workflow to create a job.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job: DocumentationJob) => (
            <button
              key={job.id}
              onClick={() => onViewJob(job.id)}
              className="w-full bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800 text-sm truncate">
                      {job.custom_title ?? job.workflow?.name ?? `Job ${job.id.slice(0, 8)}`}
                    </span>
                    <StatusBadge status={job.status} />
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      job.provider_mode === 'playwright' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {job.provider_mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock size={11} />{formatDate(job.created_at)}</span>
                    {job.duration_seconds != null && (
                      <span>Duration: {formatDuration(job.duration_seconds)}</span>
                    )}
                    {job.asset_count > 0 && (
                      <span>{job.asset_count} asset{job.asset_count !== 1 ? 's' : ''}</span>
                    )}
                    {job.error_message && (
                      <span className="text-red-400 truncate max-w-xs">{job.error_message}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

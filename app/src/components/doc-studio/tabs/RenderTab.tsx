import { useEffect, useState } from 'react';
import { Film, Plus, Trash2, Loader as Loader2, Download, ChevronDown, ChevronRight, CircleCheck as CheckCircle, Circle as XCircle, TriangleAlert as AlertTriangle, RefreshCw, Code, Clock, Save, RotateCcw, Clapperboard, Play, Ban, CircleCheck as CheckCircle2, Circle as XCircleIcon, Activity, Package, FileText, Image, Captions, LayoutGrid, List } from 'lucide-react';
import {
  useRenderProjects,
  useCreateRenderProject,
  useDeleteRenderProject,
  useBuildRenderManifest,
  useTimelineEvents,
  useDownloadRenderManifest,
  useRenderReadinessCheck,
  useUpdateRenderManifest,
} from '../../../hooks/useDocStudioRender';
import {
  useRenderJobsForDraft,
  useRenderJobArtifacts,
  usePolledRenderJob,
  usePolledRenderEvents,
  useCancelRenderJob,
} from '../../../hooks/useDocStudioRenderJobs';
import RenderOutputComparisonPanel from '../RenderOutputComparisonPanel';
import { RenderTimelinePreview } from '../RenderTimelinePreview';
import type { BlockSelection } from '../RenderTimelinePreview';
import { TimingEditPanel } from '../TimingEditPanel';
import { useToast } from '../../../lib/toast';
import { isSafeExternalUrl } from '../../../lib/browser';
import {
  RENDER_PROJECT_STATUS_LABELS,
  RENDER_PROJECT_STATUS_COLORS,
  RENDER_MODE_LABELS,
  RENDER_MODE_DESCRIPTIONS,
  RENDER_JOB_STATUS_LABELS,
  RENDER_JOB_STATUS_COLORS,
  RENDER_ARTIFACT_LABELS,
  RENDER_ENGINE_LABELS,
  ACTIVE_RENDER_STATUSES,
  TERMINAL_RENDER_STATUSES,
} from '../../../types/documentation';
import type {
  RenderProject, RenderProjectStatus, RenderMode,
  RenderManifest, RenderJob, RenderJobArtifact, RenderArtifactType, RenderOutputSummary,
} from '../../../types/documentation';
import GenerateFinishedTutorialModal from '../GenerateFinishedTutorialModal';

// ─── Readiness Panel ──────────────────────────────────────────────────────────

function ReadinessPanel({ draftId }: { draftId: string }) {
  const { data: check, isLoading, refetch } = useRenderReadinessCheck(draftId);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-blue-500" /></div>;
  }
  if (!check) return null;

  const items: Array<{ label: string; passed: boolean; value?: string }> = [
    { label: 'Scenes defined', passed: check.has_scenes },
    { label: 'Narration audio ready', passed: check.has_narration_audio },
    { label: 'Captions generated', passed: check.has_captions },
    { label: 'Timing manifest present', passed: check.has_timing_manifest },
    { label: 'Scene segmentation complete', passed: check.scene_segmentation_complete },
    { label: 'Narration coverage', passed: check.narration_coverage_pct >= 80, value: `${check.narration_coverage_pct}%` },
    { label: 'Caption coverage', passed: check.caption_coverage_pct >= 80, value: `${check.caption_coverage_pct}%` },
    { label: 'Screenshot coverage', passed: check.screenshot_coverage_pct >= 50, value: `${check.screenshot_coverage_pct}%` },
    { label: 'Timing integrity', passed: check.timing_integrity_ok },
  ];
  const passCount = items.filter(i => i.passed).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Render Readiness</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${check.overall_ready ? 'text-green-600' : 'text-amber-600'}`}>
            {passCount}/{items.length} passed
          </span>
          <button onClick={() => refetch()} className="p-1 hover:bg-slate-200 rounded transition-colors">
            <RefreshCw size={11} className="text-slate-400" />
          </button>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-2">
            {item.passed
              ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
              : <XCircle size={12} className="text-slate-300 flex-shrink-0" />}
            <span className="text-xs text-slate-700 flex-1">{item.label}</span>
            {item.value && <span className={`text-xs font-medium tabular-nums ${item.passed ? 'text-green-600' : 'text-amber-600'}`}>{item.value}</span>}
          </div>
        ))}
      </div>
      {check.warnings.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-1.5">
          {check.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">{w}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Render Job Status Badge ──────────────────────────────────────────────────

function RenderJobStatusBadge({ status }: { status: RenderJob['status'] }) {
  const color = RENDER_JOB_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600';
  const label = RENDER_JOB_STATUS_LABELS[status] ?? status;
  const isActive = ACTIVE_RENDER_STATUSES.includes(status);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {isActive && <Loader2 size={8} className="animate-spin" />}
      {status === 'completed' && <CheckCircle2 size={8} />}
      {status === 'failed' && <XCircleIcon size={8} />}
      {status === 'cancelled' && <Ban size={8} />}
      {label}
    </span>
  );
}

// ─── Active Render Job Card ───────────────────────────────────────────────────

function ActiveRenderJobCard({ jobId, draftId }: { jobId: string; draftId: string }) {
  const [now] = useState(() => Date.now());
  const { data: job, isActive } = usePolledRenderJob(jobId);
  const { data: events = [] } = usePolledRenderEvents(jobId, isActive);
  const cancel = useCancelRenderJob();
  const { showToast } = useToast();

  if (!job) return null;

  const lastEvent = events[events.length - 1];

  const handleCancel = async () => {
    if (!window.confirm('Cancel this render job?')) return;
    try {
      await cancel.mutateAsync({ jobId: job.id, draftId });
      showToast('Render job cancelled', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed to cancel render job'), 'error');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-blue-500" />
          <span className="text-xs font-semibold text-slate-700">Active Render Job</span>
        </div>
        <RenderJobStatusBadge status={job.status} />
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-600">{job.current_step ?? 'Initializing…'}</span>
            <span className="text-xs font-semibold tabular-nums text-blue-600">{job.progress_percent ?? 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${job.progress_percent ?? 0}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="capitalize">{job.engine_provider} engine • {job.render_mode?.replace(/_/g, ' ')}</span>
          {job.started_at && (
            <span className="tabular-nums">
              {Math.round((now - new Date(job.started_at).getTime()) / 1000)}s elapsed
            </span>
          )}
        </div>

        {lastEvent && (
          <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg truncate">
            {lastEvent.title}
          </div>
        )}

        {isActive && (
          <button
            onClick={handleCancel}
            disabled={cancel.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Ban size={11} />
            Cancel Render
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Render Job History Row ───────────────────────────────────────────────────

const ARTIFACT_TYPE_ORDER: RenderArtifactType[] = [
  'rendered_video', 'render_preview', 'render_thumbnail',
  'subtitle_srt', 'subtitle_vtt', 'render_log', 'render_manifest_export',
];

const ARTIFACT_ICON: Record<RenderArtifactType, React.ReactNode> = {
  rendered_video: <Play size={10} />,
  render_preview: <Film size={10} />,
  render_thumbnail: <Image size={10} />,
  subtitle_srt: <FileText size={10} />,
  subtitle_vtt: <FileText size={10} />,
  render_log: <FileText size={10} />,
  render_manifest_export: <FileText size={10} />,
  render_package: <Download size={10} />,
};

function RenderJobRow({ job }: { job: RenderJob }) {
  const [expanded, setExpanded] = useState(false);
  const { data: artifacts = [] } = useRenderJobArtifacts(expanded ? job.id : null);

  const summary = job.output_summary_json as RenderOutputSummary | null;
  const hasSRT = job.status === 'completed' && summary?.has_subtitles;

  const groupedArtifacts = ARTIFACT_TYPE_ORDER.reduce<Record<string, RenderJobArtifact>>((acc, type) => {
    const match = artifacts.find(a => a.artifact_type === type);
    if (match) acc[type] = match;
    return acc;
  }, {});

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
          : <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RenderJobStatusBadge status={job.status} />
            <span className="text-xs text-slate-600 font-medium capitalize">
              {RENDER_MODE_LABELS[job.render_mode] ?? job.render_mode?.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] text-slate-400">
              {RENDER_ENGINE_LABELS[job.engine_provider] ?? job.engine_provider}
            </span>
            {hasSRT && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                <Captions size={9} />
                SRT
              </span>
            )}
            {summary?.output_resolution && (
              <span className="text-[10px] text-slate-400">{summary.output_resolution}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {job.duration_seconds != null && (
            <span className="text-xs text-slate-400 tabular-nums flex items-center gap-1">
              <Clock size={10} />
              {job.duration_seconds.toFixed(1)}s
            </span>
          )}
          <span className="text-xs text-slate-400 tabular-nums">
            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3.5 space-y-3">
          {job.error_message && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
              <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{job.error_message}</p>
            </div>
          )}

          {job.warning_message && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{job.warning_message}</p>
            </div>
          )}

          {summary && (
            <div className="flex flex-wrap gap-1.5">
              {summary.output_resolution && (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {summary.output_resolution}
                </span>
              )}
              {summary.fps && (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {summary.fps} fps
                </span>
              )}
              {summary.file_size_bytes != null && (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {(summary.file_size_bytes / 1_048_576).toFixed(1)} MB
                </span>
              )}
              {summary.is_mock && (
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  MOCK
                </span>
              )}
              <span className="text-[10px] text-slate-400 self-center font-mono">
                {job.id.slice(0, 8)}…
              </span>
            </div>
          )}

          {job.status === 'completed' && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Artifacts</p>
              <div className="space-y-1.5">
                {ARTIFACT_TYPE_ORDER.map(type => {
                  const artifact = groupedArtifacts[type];
                  return (
                    <div key={type} className="flex items-center gap-2">
                      {artifact
                        ? <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                        : <XCircleIcon size={11} className="text-slate-200 flex-shrink-0" />}
                      <span className={`text-[11px] flex-1 ${artifact ? 'text-slate-700' : 'text-slate-300'}`}>
                        {RENDER_ARTIFACT_LABELS[type]}
                      </span>
                      {artifact && (
                        <div className="flex items-center gap-1.5">
                          {artifact.file_size != null && (
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {(artifact.file_size / 1_048_576).toFixed(1)} MB
                            </span>
                          )}
                          {artifact.duration_ms && (
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {(artifact.duration_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                          {artifact.file_url && isSafeExternalUrl(artifact.file_url) ? (
                            <a
                              href={artifact.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-blue-50 transition-colors text-blue-600"
                              title={`Download ${RENDER_ARTIFACT_LABELS[type]}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <Download size={10} />
                            </a>
                          ) : (
                            <span className="p-1 text-slate-300">
                              {ARTIFACT_ICON[type]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5">
                  <Captions size={10} className={summary?.has_subtitles ? 'text-blue-500' : 'text-slate-300'} />
                  <span className="text-[10px] text-slate-500">Subtitles:</span>
                  {groupedArtifacts['subtitle_srt'] && groupedArtifacts['subtitle_vtt'] ? (
                    <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">SRT + VTT</span>
                  ) : groupedArtifacts['subtitle_srt'] ? (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">SRT only</span>
                  ) : groupedArtifacts['subtitle_vtt'] ? (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">VTT only</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">None</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Render Jobs Section ──────────────────────────────────────────────────────

function RenderJobsSection({
  draftId,
  organizationId,
  draftTitle,
}: {
  draftId: string;
  organizationId?: string;
  draftTitle?: string;
}) {
  const { data: jobs = [], isLoading, refetch } = useRenderJobsForDraft(draftId);
  const [showModal, setShowModal] = useState(false);

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const uniqueModes = new Set(completedJobs.map(j => j.render_mode));
  const defaultView = uniqueModes.size >= 2 ? 'compare' : 'history';
  const [view, setView] = useState<'compare' | 'history'>(defaultView);
  const [viewManuallySet, setViewManuallySet] = useState(false);

  useEffect(() => {
    if (!viewManuallySet) {
      setView(defaultView);
    }
  }, [defaultView, viewManuallySet]);

  const activeJob = jobs.find(j => ACTIVE_RENDER_STATUSES.includes(j.status));
  const recentJobs = jobs.filter(j => TERMINAL_RENDER_STATUSES.includes(j.status)).slice(0, 10);

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard size={15} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Finished Tutorial Generation</span>
          {jobs.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
              {jobs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {jobs.length > 0 && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => { setView('compare'); setViewManuallySet(true); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                  view === 'compare' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Side-by-side output comparison"
              >
                <LayoutGrid size={10} />
                Compare
              </button>
              <button
                onClick={() => { setView('history'); setViewManuallySet(true); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                  view === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Chronological job history"
              >
                <List size={10} />
                History
              </button>
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} className="text-slate-400" />
          </button>
          {organizationId && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <Clapperboard size={13} />
              Generate Tutorial
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-blue-500" />
        </div>
      )}

      {/* Active Job — always shown regardless of view */}
      {activeJob && (
        <ActiveRenderJobCard jobId={activeJob.id} draftId={draftId} />
      )}

      {/* Compare View */}
      {!isLoading && jobs.length > 0 && view === 'compare' && (
        <RenderOutputComparisonPanel
          draftId={draftId}
          onGenerate={() => setShowModal(true)}
        />
      )}

      {/* History View */}
      {view === 'history' && recentJobs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Package size={12} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Render History ({recentJobs.length})
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {recentJobs.map(job => (
              <RenderJobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && jobs.length === 0 && (
        <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-xl">
          <Clapperboard size={24} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600 mb-1">No render jobs yet</p>
          <p className="text-xs text-slate-400 mb-4">
            Generate a finished tutorial to produce a complete MP4 video asset.
          </p>
          {organizationId && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <Clapperboard size={14} />
              Generate First Tutorial
            </button>
          )}
        </div>
      )}

      {showModal && organizationId && (
        <GenerateFinishedTutorialModal
          draftId={draftId}
          organizationId={organizationId}
          draftTitle={draftTitle ?? 'Tutorial'}
          onClose={() => setShowModal(false)}
          onJobStarted={() => {
            setShowModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ─── Render Project Card ──────────────────────────────────────────────────────

function RenderProjectCard({
  project,
  isSelected,
  onSelect,
  onDelete,
}: {
  project: RenderProject;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const status = project.render_status as RenderProjectStatus;
  const statusColor = RENDER_PROJECT_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600';
  const isAnimated = ['assembling_assets', 'building_timeline', 'rendering'].includes(status);

  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {RENDER_MODE_LABELS[project.render_mode as RenderMode] ?? project.render_mode}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
            {RENDER_MODE_DESCRIPTIONS[project.render_mode as RenderMode] ?? ''}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor} flex items-center gap-1`}>
          {isAnimated && <Loader2 size={8} className="animate-spin" />}
          {RENDER_PROJECT_STATUS_LABELS[status] ?? status}
        </span>
        {project.total_duration_ms && (
          <span className="text-[10px] text-slate-400 tabular-nums flex items-center gap-0.5">
            <Clock size={9} />
            {(project.total_duration_ms / 1000).toFixed(1)}s
          </span>
        )}
        {project.scene_count && (
          <span className="text-[10px] text-slate-400">{project.scene_count} scenes</span>
        )}
      </div>
    </div>
  );
}

// ─── Render Project Detail ────────────────────────────────────────────────────

function RenderProjectDetail({ project }: { project: RenderProject }) {
  const { showToast } = useToast();
  const buildManifest = useBuildRenderManifest();
  const downloadManifest = useDownloadRenderManifest();
  const updateManifest = useUpdateRenderManifest();
  const { data: timelineEvents = [] } = useTimelineEvents(project.id);
  const [showManifestJson, setShowManifestJson] = useState(false);
  const [localManifest, setLocalManifest] = useState<RenderManifest | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockSelection | null>(null);

  const isDirty = localManifest !== null;
  const rawManifest = (localManifest ?? project.render_manifest_json) as RenderManifest | null;
  const displayManifest: RenderManifest | null = rawManifest
    ? {
        ...rawManifest,
        scenes: (rawManifest.scenes ?? []).map(s => ({
          ...s,
          captions: s.captions ?? [],
          screenshot_overlays: s.screenshot_overlays ?? [],
          video_segments: s.video_segments ?? [],
        })),
      }
    : null;

  const status = project.render_status as RenderProjectStatus;
  const canBuild = !['rendering', 'assembling_assets', 'building_timeline'].includes(status);

  const handleBuild = async () => {
    try {
      await buildManifest.mutateAsync({
        project_id: project.id,
        draft_id: project.draft_id,
        draft_title: '',
      });
      setLocalManifest(null);
      setSelectedBlock(null);
      showToast('Render manifest built', 'success');
    } catch {
      showToast('Failed to build render manifest', 'error');
    }
  };

  const handleDownload = () => {
    if (!displayManifest) return;
    downloadManifest.mutate(project.id);
  };

  const handleSaveTimingChanges = async () => {
    if (!localManifest) return;
    try {
      await updateManifest.mutateAsync({
        project_id: project.id,
        draft_id: project.draft_id,
        manifest: localManifest,
      });
      setLocalManifest(null);
      showToast('Timing changes saved', 'success');
    } catch {
      showToast('Failed to save timing changes', 'error');
    }
  };

  const handleDiscardChanges = () => {
    setLocalManifest(null);
    setSelectedBlock(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {RENDER_MODE_LABELS[project.render_mode as RenderMode] ?? project.render_mode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button
                onClick={handleDiscardChanges}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RotateCcw size={11} />
                Discard
              </button>
              <button
                onClick={handleSaveTimingChanges}
                disabled={updateManifest.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {updateManifest.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Save timing changes
              </button>
            </>
          )}
          {displayManifest && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download size={12} />
              Manifest JSON
            </button>
          )}
          <button
            onClick={handleBuild}
            disabled={buildManifest.isPending || !canBuild}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {buildManifest.isPending ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
            {displayManifest ? 'Rebuild Manifest' : 'Build Manifest'}
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Clock size={12} className="text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700">You have unsaved timing edits. Save or discard before rebuilding the manifest.</p>
        </div>
      )}

      {project.error_message && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{project.error_message}</p>
        </div>
      )}

      {project.render_warnings_json && project.render_warnings_json.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
          {project.render_warnings_json.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{w}</p>
            </div>
          ))}
        </div>
      )}

      {displayManifest && (
        <RenderTimelinePreview
          manifest={displayManifest}
          selectedBlock={selectedBlock}
          onBlockSelect={setSelectedBlock}
        />
      )}

      {selectedBlock && displayManifest && (
        <TimingEditPanel
          manifest={displayManifest}
          selection={selectedBlock}
          onApply={(updatedManifest) => { setLocalManifest(updatedManifest as RenderManifest); setSelectedBlock(null); }}
          onClose={() => setSelectedBlock(null)}
        />
      )}

      {timelineEvents.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Timeline Events ({timelineEvents.length})
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {timelineEvents.slice(0, 20).map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className="text-slate-400 tabular-nums w-24 flex-shrink-0">
                  {(ev.start_ms / 1000).toFixed(2)}s
                </span>
                <span className="text-slate-500 capitalize flex-1">{ev.event_type.replace(/_/g, ' ')}</span>
                <span className="text-slate-400 tabular-nums">{(ev.duration_ms / 1000).toFixed(2)}s</span>
              </div>
            ))}
            {timelineEvents.length > 20 && (
              <div className="px-4 py-2 text-xs text-slate-400 text-center">
                +{timelineEvents.length - 20} more events
              </div>
            )}
          </div>
        </div>
      )}

      {displayManifest && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowManifestJson(v => !v)}
            className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code size={13} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Manifest JSON</span>
              <span className="text-xs text-slate-400">
                {(JSON.stringify(displayManifest).length / 1024).toFixed(1)} KB
              </span>
            </div>
            {showManifestJson
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />}
          </button>
          {showManifestJson && (
            <div className="border-t border-slate-100">
              <pre className="px-4 py-3 text-xs text-slate-600 font-mono leading-relaxed overflow-x-auto max-h-72 bg-slate-50 whitespace-pre-wrap">
                {JSON.stringify(displayManifest, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {!displayManifest && (
        <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl">
          <Film size={24} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600 mb-1">No manifest yet</p>
          <p className="text-xs text-slate-400">Build the render manifest to generate the full scene timeline.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Props {
  draftId: string;
  organizationId?: string;
  draftTitle?: string;
}

export function RenderTab({ draftId, organizationId, draftTitle }: Props) {
  const { showToast } = useToast();
  const { data: projects = [], isLoading } = useRenderProjects(draftId);
  const createProject = useCreateRenderProject();
  const deleteProject = useDeleteRenderProject();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMode, setSelectedMode] = useState<RenderMode>('standard_training');
  const [notes, setNotes] = useState('');

  const selectedProject = projects.find(p => p.id === selectedId) ?? (projects.length > 0 ? projects[0] : null);

  const handleCreate = async () => {
    try {
      const project = await createProject.mutateAsync({
        draft_id: draftId,
        organization_id: organizationId,
        render_mode: selectedMode,
        notes: notes.trim() || undefined,
      });
      setSelectedId(project.id);
      setShowCreateForm(false);
      setNotes('');
      showToast('Render project created', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed to create render project'), 'error');
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm('Delete this render project? This cannot be undone.')) return;
    try {
      await deleteProject.mutateAsync({ project_id: projectId, draft_id: draftId });
      if (selectedId === projectId) setSelectedId(null);
      showToast('Render project deleted', 'success');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : 'Failed to delete render project'), 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Finished Tutorial Generation */}
      <RenderJobsSection
        draftId={draftId}
        organizationId={organizationId}
        draftTitle={draftTitle}
      />

      <div className="border-t border-slate-200" />

      {/* Render Projects (manifest builder) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film size={15} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Render Orchestration</span>
          </div>
          <button
            onClick={() => setShowCreateForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={13} />
            New Render Project
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">New Render Project</p>
            <div className="space-y-2">
              {(Object.entries(RENDER_MODE_LABELS) as [RenderMode, string][]).map(([mode, label]) => (
                <label
                  key={mode}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    selectedMode === mode ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    value={mode}
                    checked={selectedMode === mode}
                    onChange={() => setSelectedMode(mode)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{RENDER_MODE_DESCRIPTIONS[mode]}</p>
                  </div>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notes (optional)</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Admin role variant"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createProject.isPending}
                className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {createProject.isPending && <Loader2 size={12} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        )}

        <ReadinessPanel draftId={draftId} />

        {projects.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {projects.map(project => (
              <RenderProjectCard
                key={project.id}
                project={project}
                isSelected={selectedProject?.id === project.id}
                onSelect={() => setSelectedId(project.id)}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>
        )}

        {selectedProject && (
          <div className="border-t border-slate-200 pt-4">
            <RenderProjectDetail key={selectedProject.id} project={selectedProject} />
          </div>
        )}

        {projects.length === 0 && !showCreateForm && (
          <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl">
            <Film size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 mb-1">No render projects yet</p>
            <p className="text-xs text-slate-400 mb-4">
              Create a render project to build the scene manifest and prepare for final video rendering.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Create First Render Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

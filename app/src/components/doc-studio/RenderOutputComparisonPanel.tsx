import { Film, Captions, Download, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert, Clapperboard, Clock, Monitor, Zap, BookOpen, BookMarked, RefreshCw } from 'lucide-react';
import {
  useRenderJobsForDraft,
  useRenderJobArtifacts,
} from '../../hooks/useDocStudioRenderJobs';
import { isSafeExternalUrl } from '../../lib/browser';
import {
  RENDER_MODE_LABELS,
  RENDER_MODE_DESCRIPTIONS,
  RENDER_JOB_STATUS_COLORS,
  RENDER_JOB_STATUS_LABELS,
  RENDER_ENGINE_LABELS,
  RENDER_ARTIFACT_LABELS,
  ACTIVE_RENDER_STATUSES,
} from '../../types/documentation';
import type { RenderJob, RenderMode, RenderJobArtifact, RenderArtifactType, RenderOutputSummary } from '../../types/documentation';

// ─── Artifact Completeness Grid ───────────────────────────────────────────────

const ARTIFACT_ORDER: RenderArtifactType[] = [
  'rendered_video',
  'render_preview',
  'render_thumbnail',
  'subtitle_srt',
  'subtitle_vtt',
];

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function ArtifactCompletenessGrid({ jobId }: { jobId: string }) {
  const { data: artifacts = [], isLoading } = useRenderJobArtifacts(jobId);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {ARTIFACT_ORDER.map(type => (
          <div key={type} className="h-6 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const artifactMap = new Map<RenderArtifactType, RenderJobArtifact>();
  artifacts.forEach(a => {
    if (!artifactMap.has(a.artifact_type)) artifactMap.set(a.artifact_type, a);
  });

  const hasSRT = artifactMap.has('subtitle_srt');
  const hasVTT = artifactMap.has('subtitle_vtt');

  return (
    <div className="space-y-1.5">
      {ARTIFACT_ORDER.map(type => {
        const artifact = artifactMap.get(type);
        const safeFileUrl = artifact?.file_url && isSafeExternalUrl(artifact.file_url) ? artifact.file_url : null;
        return (
          <div key={type} className="flex items-center gap-2">
            {artifact ? (
              <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
            ) : (
              <XCircle size={11} className="text-slate-300 flex-shrink-0" />
            )}
            <span className={`text-[11px] flex-1 ${artifact ? 'text-slate-700' : 'text-slate-400'}`}>
              {RENDER_ARTIFACT_LABELS[type]}
            </span>
            {artifact && (
              <div className="flex items-center gap-1.5">
                {artifact.file_size != null && (
                  <span className="text-[10px] text-slate-400 tabular-nums">{formatBytes(artifact.file_size)}</span>
                )}
                {safeFileUrl && (
                  <a
                    href={safeFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 rounded hover:bg-slate-100 transition-colors text-blue-600"
                    title={`Download ${RENDER_ARTIFACT_LABELS[type]}`}
                  >
                    <Download size={9} />
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5">
        <Captions size={10} className={hasSRT || hasVTT ? 'text-blue-500' : 'text-slate-300'} />
        <span className="text-[10px] font-medium text-slate-600">Subtitles:</span>
        {hasSRT && hasVTT ? (
          <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">SRT + VTT</span>
        ) : hasSRT ? (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">SRT only</span>
        ) : hasVTT ? (
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">VTT only</span>
        ) : (
          <span className="text-[10px] font-medium text-slate-400">None</span>
        )}
      </div>
    </div>
  );
}

// ─── Quality Notes Panel ──────────────────────────────────────────────────────

function QualityNotesPanel({ job }: { job: RenderJob }) {
  const summary = job.output_summary_json as RenderOutputSummary | null;

  const artifactScore = summary
    ? [summary.has_subtitles, summary.has_preview, summary.has_thumbnail].filter(Boolean).length
    : 0;

  return (
    <div className="space-y-2">
      {summary && (
        <div className="flex flex-wrap gap-1.5">
          {summary.output_resolution && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              <Monitor size={9} />
              {summary.output_resolution}
            </span>
          )}
          {summary.fps && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              <Zap size={9} />
              {summary.fps} fps
            </span>
          )}
          {summary.file_size_bytes != null && (
            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {formatBytes(summary.file_size_bytes)}
            </span>
          )}
          {summary.is_mock && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              MOCK
            </span>
          )}
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
            artifactScore === 3 ? 'bg-green-100 text-green-700' :
            artifactScore >= 1 ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-500'
          }`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <CheckCircle2 key={i} size={8} className={i < artifactScore ? '' : 'opacity-30'} />
            ))}
            {artifactScore}/3
          </span>
        </div>
      )}

      {job.warning_message && (
        <div className="flex items-start gap-1.5 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <TriangleAlert size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700">{job.warning_message}</p>
        </div>
      )}
    </div>
  );
}

// ─── Mode Column ──────────────────────────────────────────────────────────────

const MODE_ICONS: Record<RenderMode, React.ReactNode> = {
  quick_preview: <Film size={14} className="text-slate-500" />,
  standard_training: <BookOpen size={14} className="text-blue-600" />,
  detailed_walkthrough: <BookMarked size={14} className="text-blue-600" />,
};

const MODE_ACCENT: Record<RenderMode, string> = {
  quick_preview: 'border-slate-200 bg-white',
  standard_training: 'border-blue-200 bg-blue-50/30',
  detailed_walkthrough: 'border-blue-200 bg-blue-50/30',
};

const MODE_HEADER_ACCENT: Record<RenderMode, string> = {
  quick_preview: 'bg-slate-50 border-slate-100',
  standard_training: 'bg-blue-50 border-blue-100',
  detailed_walkthrough: 'bg-blue-50 border-blue-100',
};

function ModeColumn({
  mode,
  job,
  onGenerate,
}: {
  mode: RenderMode;
  job: RenderJob | null;
  onGenerate?: () => void;
}) {
  const summary = job?.output_summary_json as RenderOutputSummary | null;
  const totalDuration = summary?.total_duration_ms != null
    ? `${(summary.total_duration_ms / 1000).toFixed(1)}s`
    : job?.duration_seconds != null
      ? `${job.duration_seconds.toFixed(1)}s render`
      : null;

  return (
    <div className={`flex flex-col rounded-xl border overflow-hidden ${MODE_ACCENT[mode]}`}>
      <div className={`flex items-center gap-2 px-3.5 py-2.5 border-b ${MODE_HEADER_ACCENT[mode]}`}>
        {MODE_ICONS[mode]}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{RENDER_MODE_LABELS[mode]}</p>
        </div>
        {job && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${RENDER_JOB_STATUS_COLORS[job.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {RENDER_JOB_STATUS_LABELS[job.status] ?? job.status}
          </span>
        )}
      </div>

      <div className="flex-1 p-3.5 space-y-3.5">
        <p className="text-[11px] text-slate-500 leading-relaxed">{RENDER_MODE_DESCRIPTIONS[mode]}</p>

        {job ? (
          <>
            <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
              {job.engine_provider && (
                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                  {RENDER_ENGINE_LABELS[job.engine_provider]}
                </span>
              )}
              {totalDuration && (
                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                  <Clock size={8} />
                  {totalDuration}
                </span>
              )}
              {job.created_at && (
                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                  {new Date(job.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            {job.status === 'completed' && (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Artifacts</p>
                  <ArtifactCompletenessGrid jobId={job.id} />
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Quality</p>
                  <QualityNotesPanel job={job} />
                </div>
              </>
            )}

            {job.status === 'failed' && job.error_message && (
              <div className="flex items-start gap-1.5 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg">
                <XCircle size={11} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-700">{job.error_message}</p>
              </div>
            )}

            {ACTIVE_RENDER_STATUSES.includes(job.status) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{job.current_step ?? 'Processing…'}</span>
                  <span className="font-semibold text-blue-600 tabular-nums">{job.progress_percent ?? 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${job.progress_percent ?? 0}%` }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              {MODE_ICONS[mode]}
            </div>
            <p className="text-[11px] text-slate-400 text-center">Not generated yet</p>
            {onGenerate && (
              <button
                onClick={onGenerate}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Clapperboard size={10} />
                Generate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RenderOutputComparisonPanelProps {
  draftId: string;
  onGenerate?: () => void;
}

const RENDER_MODES: RenderMode[] = ['quick_preview', 'standard_training', 'detailed_walkthrough'];

export default function RenderOutputComparisonPanel({ draftId, onGenerate }: RenderOutputComparisonPanelProps) {
  const { data: jobs = [], isLoading, refetch } = useRenderJobsForDraft(draftId);

  const jobByMode = new Map<RenderMode, RenderJob>();
  jobs.forEach(job => {
    const existing = jobByMode.get(job.render_mode);
    if (!existing || new Date(job.created_at) > new Date(existing.created_at)) {
      jobByMode.set(job.render_mode, job);
    }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {RENDER_MODES.map(mode => (
          <div key={mode} className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Output Comparison</span>
          {jobs.length > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
              {jobByMode.size}/3 modes generated
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {RENDER_MODES.map(mode => (
          <ModeColumn
            key={mode}
            mode={mode}
            job={jobByMode.get(mode) ?? null}
            onGenerate={onGenerate}
          />
        ))}
      </div>
    </div>
  );
}

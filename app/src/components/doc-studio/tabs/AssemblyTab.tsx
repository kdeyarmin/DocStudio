import { useState } from 'react';
import {
  Layers, Play, RefreshCw, CircleCheck as CheckCircle, Circle as XCircle,
  CircleAlert as AlertCircle, Clock, Mic, FileText, Package,
  ChevronDown, ChevronRight, Info, TriangleAlert as WarningTriangle,
} from 'lucide-react';
import {
  useAssemblyState,
  useAssemblyHealth,
  useAssembleAudio,
  useAssembleCaptions,
} from '../../../hooks/useDocStudioAssembly';
import { useRunFullAssembly } from '../../../hooks/useDocStudioPackage';
import { useToast } from '../../../lib/toast';
import { ASSEMBLY_STATUS_LABELS, ASSEMBLY_STATUS_COLORS } from '../../../types/documentation';
import type { SceneAudioMapRecord, AssemblyStatus } from '../../../types/documentation';

interface AssemblyTabProps {
  draftId: string;
  organizationId: string;
  currentAssemblyStatus?: AssemblyStatus | null;
}

function StatusBadge({ status }: { status: string }) {
  const color = ASSEMBLY_STATUS_COLORS[status as AssemblyStatus] ?? 'bg-slate-100 text-slate-600';
  const label = ASSEMBLY_STATUS_LABELS[status as AssemblyStatus] ?? status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function CoverageBar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-9 text-right">{pct}%</span>
    </div>
  );
}

type PipelineStepStatus = 'complete' | 'partial' | 'empty' | 'loading';

function PipelineStep({
  icon: Icon,
  label,
  detail,
  status,
  connector,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  status: PipelineStepStatus;
  connector?: boolean;
}) {
  const ring =
    status === 'complete' ? 'border-green-400 bg-green-50 text-green-600'
    : status === 'partial' ? 'border-amber-400 bg-amber-50 text-amber-600'
    : status === 'loading' ? 'border-blue-300 bg-blue-50 text-blue-500'
    : 'border-slate-200 bg-slate-50 text-slate-400';

  return (
    <div className="flex items-stretch gap-0">
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 ${ring}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xs font-semibold text-slate-700 text-center leading-tight">{label}</div>
        <div className="text-xs text-slate-400 text-center leading-tight">{detail}</div>
      </div>
      {connector && (
        <div className="flex items-start pt-4 px-1 shrink-0">
          <div className="w-8 h-0.5 bg-slate-200 mt-0.5" />
        </div>
      )}
    </div>
  );
}

function FlagPill({ active, color, label }: { active: boolean; color: string; label: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${active ? color : 'bg-slate-100 text-slate-300'}`}>
      {label}
    </span>
  );
}

function SceneRow({ record }: { record: SceneAudioMapRecord }) {
  const hasWarnings = record.missing_asset_warnings?.length > 0;
  const [warnOpen, setWarnOpen] = useState(false);

  const statusColor =
    record.status === 'ready' ? 'text-green-500'
    : record.status === 'audio_ready' ? 'text-blue-500'
    : record.status === 'segment_only' ? 'text-amber-500'
    : 'text-red-400';

  const statusIcon =
    record.status === 'ready' ? <CheckCircle className={`w-4 h-4 ${statusColor} shrink-0`} />
    : record.status === 'audio_ready' ? <Mic className={`w-4 h-4 ${statusColor} shrink-0`} />
    : record.status === 'segment_only' ? <AlertCircle className={`w-4 h-4 ${statusColor} shrink-0`} />
    : <XCircle className={`w-4 h-4 ${statusColor} shrink-0`} />;

  const estDur = record.estimated_duration_seconds;
  const actDur = record.actual_duration_seconds;
  const durDisplay = actDur != null
    ? `${actDur.toFixed(1)}s`
    : estDur != null
    ? `~${estDur.toFixed(1)}s`
    : '—';

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2.5 py-2 px-3 hover:bg-slate-50 rounded-lg">
        {statusIcon}
        <span className="flex-1 text-slate-700 truncate font-medium">
          {record.scene?.title ?? `Scene ${record.scene_id.slice(0, 6)}`}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <FlagPill active={record.has_transcript} color="bg-violet-100 text-violet-600" label="TRX" />
          <FlagPill active={record.has_audio} color="bg-blue-100 text-blue-600" label="AUD" />
          <FlagPill active={record.has_captions} color="bg-emerald-100 text-emerald-600" label="CAP" />
        </div>
        <span className="text-slate-400 font-mono w-16 text-right shrink-0">{durDisplay}</span>
        {hasWarnings ? (
          <button
            onClick={() => setWarnOpen(o => !o)}
            className="flex items-center gap-0.5 text-amber-500 hover:text-amber-600 shrink-0"
            title={`${record.missing_asset_warnings.length} warning(s)`}
          >
            <WarningTriangle className="w-3.5 h-3.5" />
            <span>{record.missing_asset_warnings.length}</span>
          </button>
        ) : (
          <span className="w-7 shrink-0" />
        )}
      </div>
      {hasWarnings && warnOpen && (
        <div className="mx-3 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
          {record.missing_asset_warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssemblyTab({ draftId, organizationId, currentAssemblyStatus }: AssemblyTabProps) {
  const toast = useToast();
  const [scenesOpen, setScenesOpen] = useState(false);

  const { data: state, isLoading: stateLoading } = useAssemblyState(draftId);
  const { data: health, isLoading: healthLoading } = useAssemblyHealth(draftId);

  const assembleAudio = useAssembleAudio(draftId);
  const assembleCaptions = useAssembleCaptions(draftId);
  const fullAssembly = useRunFullAssembly(draftId);

  const isBusy = assembleAudio.isPending || assembleCaptions.isPending || fullAssembly.isPending;

  async function handleFullAssembly() {
    try {
      await fullAssembly.mutateAsync({ organizationId });
      toast.showToast('Full assembly completed', 'success');
    } catch (e) {
      toast.showToast(String(e), 'error');
    }
  }

  async function handleAssembleAudio() {
    try {
      await assembleAudio.mutateAsync({ organizationId });
      toast.showToast('Audio assembly completed', 'success');
    } catch (e) {
      toast.showToast(String(e), 'error');
    }
  }

  async function handleAssembleCaptions() {
    try {
      await assembleCaptions.mutateAsync({ organizationId });
      toast.showToast('Caption assembly completed', 'success');
    } catch (e) {
      toast.showToast(String(e), 'error');
    }
  }

  const isLoading = stateLoading || healthLoading;

  const audioPct = health?.audio_coverage_pct ?? (
    state?.audioAssembly?.assembled_scene_count != null
      ? Math.round(((state.audioAssembly.assembled_scene_count) / Math.max(state.audioAssembly.scene_count ?? 1, 1)) * 100)
      : 0
  );
  const captionPct = health?.caption_coverage_pct ?? 0;

  const audioStepStatus: PipelineStepStatus =
    isLoading ? 'loading'
    : (state?.audioAssembly?.assembled_scene_count ?? 0) === 0 ? 'empty'
    : audioPct >= 100 ? 'complete'
    : 'partial';

  const captionStepStatus: PipelineStepStatus =
    isLoading ? 'loading'
    : (state?.captionManifest?.total_blocks ?? 0) === 0 ? 'empty'
    : captionPct >= 100 ? 'complete'
    : 'partial';

  const packageStepStatus: PipelineStepStatus =
    isLoading ? 'loading'
    : health?.isReadyForAssembly ? 'complete'
    : audioStepStatus !== 'empty' && captionStepStatus !== 'empty' ? 'partial'
    : 'empty';

  const sceneMap = state?.sceneAudioMap ?? [];
  const warningScenes = sceneMap.filter(r => (r.missing_asset_warnings?.length ?? 0) > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Assembly Pipeline</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Build audio, captions, and tutorial package from narration segments
          </p>
        </div>
        {currentAssemblyStatus && <StatusBadge status={currentAssemblyStatus} />}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <PipelineStep
            icon={Mic}
            label="Audio"
            detail={audioStepStatus === 'complete' ? 'All scenes' : audioStepStatus === 'partial' ? `${state?.audioAssembly?.assembled_scene_count ?? 0}/${state?.audioAssembly?.scene_count ?? 0}` : 'Not run'}
            status={audioStepStatus}
            connector
          />
          <PipelineStep
            icon={FileText}
            label="Captions"
            detail={captionStepStatus === 'complete' ? 'All scenes' : captionStepStatus === 'partial' ? `${state?.captionManifest?.total_blocks ?? 0} blocks` : 'Not run'}
            status={captionStepStatus}
            connector
          />
          <PipelineStep
            icon={Package}
            label="Package"
            detail={health?.isReadyForAssembly ? 'Ready' : (health?.blockingIssues?.length ?? 0) > 0 ? `${health?.blockingIssues?.length} issue(s)` : 'Pending'}
            status={packageStepStatus}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={handleFullAssembly}
          disabled={isBusy}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {fullAssembly.isPending
            ? <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            : <Play className="w-5 h-5 text-blue-600" />}
          <span className="text-xs font-semibold text-blue-700">Run Full Assembly</span>
          <span className="text-xs text-blue-500 text-center">Audio + Captions + Package</span>
        </button>

        <button
          onClick={handleAssembleAudio}
          disabled={isBusy}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {assembleAudio.isPending
            ? <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
            : <Mic className="w-4 h-4 text-slate-600" />}
          <span className="text-xs font-medium text-slate-700">Audio Only</span>
        </button>

        <button
          onClick={handleAssembleCaptions}
          disabled={isBusy}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {assembleCaptions.isPending
            ? <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
            : <FileText className="w-4 h-4 text-slate-600" />}
          <span className="text-xs font-medium text-slate-700">Captions Only</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading assembly state…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-slate-700">Audio Coverage</span>
              </div>
              <CoverageBar pct={state?.audioAssembly?.assembled_scene_count != null
                ? Math.round(((state.audioAssembly.assembled_scene_count) / Math.max(state.audioAssembly.scene_count, 1)) * 100)
                : 0} color="bg-blue-500" />
              <div className="text-xs text-slate-500">
                {state?.audioAssembly?.assembled_scene_count ?? 0}/{state?.audioAssembly?.scene_count ?? health?.totalScenes ?? 0} scenes
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700">Caption Coverage</span>
              </div>
              <CoverageBar
                pct={state?.captionManifest?.scene_count != null && state?.audioAssembly?.scene_count
                  ? Math.round((state.captionManifest.scene_count / Math.max(state.audioAssembly.scene_count, 1)) * 100)
                  : 0}
                color="bg-emerald-500"
              />
              <div className="text-xs text-slate-500">
                {state?.captionManifest?.total_blocks ?? 0} blocks · {state?.captionManifest?.scene_count ?? 0} scenes
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-700">Total Duration</span>
              </div>
              <div className="text-xl font-bold text-slate-800">
                {state?.audioAssembly?.total_duration_seconds
                  ? `${Math.floor(state.audioAssembly.total_duration_seconds / 60)}m ${Math.round(state.audioAssembly.total_duration_seconds % 60)}s`
                  : health?.estimated_total_duration_seconds
                  ? `~${Math.floor(health.estimated_total_duration_seconds / 60)}m ${Math.round(health.estimated_total_duration_seconds % 60)}s`
                  : '—'}
              </div>
              {health?.estimated_total_duration_seconds && !state?.audioAssembly?.total_duration_seconds && (
                <div className="text-xs text-slate-400">Estimated</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">Readiness</span>
              </div>
              <div className={`text-sm font-semibold ${health?.isReadyForAssembly ? 'text-green-600' : 'text-amber-600'}`}>
                {health?.isReadyForAssembly ? 'Ready to assemble' : 'Issues present'}
              </div>
              {health?.blockingIssues?.length ? (
                <ul className="space-y-0.5 mt-1">
                  {health.blockingIssues.map((issue, i) => (
                    <li key={i} className="text-xs text-red-500 flex items-start gap-1">
                      <XCircle className="w-3 h-3 mt-0.5 shrink-0" /> {issue}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {health && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-3">Health Breakdown</h4>
              <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                {[
                  { label: 'Complete', value: health.complete_scenes, color: 'text-green-600' },
                  { label: 'Audio Ready', value: health.audio_ready_scenes, color: 'text-blue-600' },
                  { label: 'Captions Ready', value: health.captions_ready_scenes, color: 'text-emerald-600' },
                  { label: 'Missing Audio', value: health.missing_audio_scenes, color: health.missing_audio_scenes > 0 ? 'text-amber-600' : 'text-slate-400' },
                  { label: 'Missing Transcript', value: health.missing_transcript_scenes, color: health.missing_transcript_scenes > 0 ? 'text-amber-600' : 'text-slate-400' },
                  { label: 'Errors', value: health.error_scenes, color: health.error_scenes > 0 ? 'text-red-500' : 'text-slate-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                    <span className="text-slate-500">{item.label}</span>
                    <span className={`font-semibold tabular-nums ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
              {health.warnings && health.warnings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {health.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                      <Info className="w-3 h-3 mt-0.5 shrink-0" /> {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sceneMap.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
                onClick={() => setScenesOpen(o => !o)}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Scene Audio Map</span>
                  <span className="text-xs text-slate-400">({sceneMap.length} scenes)</span>
                  {warningScenes.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <WarningTriangle className="w-3 h-3" />
                      {warningScenes.length} with warnings
                    </span>
                  )}
                </div>
                {scenesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {scenesOpen && (
                <>
                  <div className="border-t border-slate-100 px-3 py-1.5 bg-slate-50 grid items-center text-xs font-medium text-slate-400"
                    style={{ gridTemplateColumns: '1rem 1fr 7rem 3rem 1.75rem' }}>
                    <span />
                    <span>Scene</span>
                    <span className="text-center">Flags (TRX · AUD · CAP)</span>
                    <span className="text-right">Duration</span>
                    <span />
                  </div>
                  <div className="divide-y divide-slate-50">
                    {sceneMap.map(r => (
                      <SceneRow key={r.scene_id} record={r} />
                    ))}
                  </div>
                  <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-100 border border-violet-300 inline-block" /> TRX = transcript</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-100 border border-blue-300 inline-block" /> AUD = audio</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" /> CAP = captions</span>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { AssemblyTab };

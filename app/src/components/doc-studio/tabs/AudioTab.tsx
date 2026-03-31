import { useState } from 'react';
import { Mic, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, RefreshCw, Volume2, Captions, Copy, CheckCheck, ChevronDown } from 'lucide-react';
import { useAssemblyState, useAssembleAudio } from '../../../hooks/useDocStudioAssembly';
import { useToast } from '../../../lib/toast';
import type { SceneAudioMapRecord, SceneAudioMapStatus } from '../../../types/documentation';

interface AudioTabProps {
  draftId: string;
  organizationId: string;
}

type FilterMode = 'all' | 'ready' | 'issues';

const STATUS_CONFIG: Record<SceneAudioMapStatus, { label: string; color: string; icon: React.ReactNode }> = {
  complete:             { label: 'Complete',           color: 'text-green-600',  icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" /> },
  audio_ready:         { label: 'Audio ready',        color: 'text-blue-600',   icon: <Mic className="w-3.5 h-3.5 text-blue-500" /> },
  captions_ready:      { label: 'Captions ready',     color: 'text-blue-600',   icon: <Captions className="w-3.5 h-3.5 text-blue-500" /> },
  missing_audio:       { label: 'Missing audio',      color: 'text-red-500',    icon: <XCircle className="w-3.5 h-3.5 text-red-400" /> },
  missing_transcript:  { label: 'Missing transcript', color: 'text-amber-600',  icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> },
  error:               { label: 'Error',              color: 'text-red-600',    icon: <XCircle className="w-3.5 h-3.5 text-red-500" /> },
  pending:             { label: 'Pending',            color: 'text-slate-400',  icon: <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> },
};

const READY_STATUSES: SceneAudioMapStatus[] = ['complete', 'audio_ready', 'captions_ready'];
function isReady(status: SceneAudioMapStatus): boolean {
  return READY_STATUSES.includes(status);
}

function FlagPill({ active, color, title, children }: { active: boolean; color: string; title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold transition-colors ${
        active ? `${color} bg-current/10` : 'text-slate-200 bg-slate-50'
      }`}
    >
      {children}
    </span>
  );
}

function DurationCell({ estimated, actual }: { estimated: number; actual: number | null }) {
  if (actual == null) {
    return <span className="text-xs text-slate-400 font-mono">~{estimated.toFixed(1)}s</span>;
  }
  const delta = actual - estimated;
  const pct = estimated > 0 ? Math.abs(delta / estimated) : 0;
  const showDelta = pct > 0.05;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-slate-700 font-mono">{actual.toFixed(1)}s</span>
      {showDelta && (
        <span className={`text-[10px] font-mono ${delta > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}
        </span>
      )}
    </span>
  );
}

function WarningBadge({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium hover:bg-amber-100 transition-colors"
      >
        <AlertCircle className="w-2.5 h-2.5" />
        {warnings.length}
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 w-64 bg-white border border-amber-200 rounded-lg shadow-lg p-2 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-amber-700 leading-snug">{w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetIdCell({ assetId }: { assetId: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!assetId) return <span className="text-xs text-slate-300 font-mono">—</span>;
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(assetId!).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title={assetId}
      className="inline-flex items-center gap-1 text-xs text-slate-400 font-mono hover:text-slate-700 transition-colors group"
    >
      <span className="truncate max-w-[80px]">{assetId.slice(-10)}</span>
      {copied
        ? <CheckCheck className="w-3 h-3 text-green-500 shrink-0" />
        : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />}
    </button>
  );
}

function DurationBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[48px]">
      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SceneRow({ record, index, maxDuration }: { record: SceneAudioMapRecord; index: number; maxDuration: number }) {
  const status = record.assembly_status;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const displayDuration = record.duration_seconds
    ?? record.estimated_duration_seconds
    ?? record.actual_duration_seconds
    ?? 0;

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-x-3 items-center px-4 py-2.5 text-sm hover:bg-slate-50 group">
      <div className="flex items-center gap-1.5">
        {config.icon}
        <span className="text-xs text-slate-400 w-5 text-right">{index + 1}</span>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-slate-700 truncate">
          {record.scene?.title ?? <span className="font-mono text-slate-400">{record.scene_id.slice(0, 8)}</span>}
        </span>
        <WarningBadge warnings={record.missing_asset_warnings} />
      </div>

      <DurationBar value={displayDuration} max={maxDuration} />

      <DurationCell estimated={record.estimated_duration_seconds} actual={record.actual_duration_seconds} />

      <div className="flex items-center gap-1">
        <FlagPill active={record.has_transcript} color="text-violet-600" title="Has transcript">T</FlagPill>
        <FlagPill active={record.has_audio} color="text-blue-600" title="Has audio">A</FlagPill>
        <FlagPill active={record.has_captions} color="text-blue-600" title="Has captions">C</FlagPill>
      </div>

      <AssetIdCell assetId={record.audio_asset_id} />

      <span className={`text-xs ${config.color} whitespace-nowrap`}>{config.label}</span>
    </div>
  );
}

export default function AudioTab({ draftId, organizationId }: AudioTabProps) {
  const toast = useToast();
  const { data: state, isLoading } = useAssemblyState(draftId);
  const assembleAudio = useAssembleAudio(draftId);
  const [filter, setFilter] = useState<FilterMode>('all');

  const sceneMap = state?.sceneAudioMap ?? [];
  const assembly = state?.audioAssembly;

  const filteredMap = sceneMap.filter(r => {
    if (filter === 'ready') return isReady(r.assembly_status);
    if (filter === 'issues') return !isReady(r.assembly_status);
    return true;
  });

  const maxDuration = Math.max(
    ...sceneMap.map(r => r.duration_seconds ?? r.estimated_duration_seconds ?? r.actual_duration_seconds ?? 0),
    1,
  );
  const issueCount = sceneMap.filter(r => !isReady(r.assembly_status)).length;

  async function handleReassemble() {
    try {
      await assembleAudio.mutateAsync({ organizationId });
      toast.showToast('Audio assembly refreshed', 'success');
    } catch (e) {
      toast.showToast(String(e), 'error');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading audio data…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Audio Assembly</h3>
          <p className="text-xs text-slate-500 mt-0.5">Per-scene narration audio status</p>
        </div>
        <button
          onClick={handleReassemble}
          disabled={assembleAudio.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${assembleAudio.isPending ? 'animate-spin' : ''}`} />
          Re-assemble
        </button>
      </div>

      {assembly && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Scenes', value: assembly.scene_count, color: 'text-slate-800' },
            { label: 'With Audio', value: assembly.assembled_scene_count, color: 'text-green-600' },
            { label: 'Coverage', value: `${assembly.audio_coverage_pct}%`, color: 'text-blue-600' },
            {
              label: 'Runtime',
              value: assembly.total_duration_seconds
                ? `${Math.floor(assembly.total_duration_seconds / 60)}m ${Math.round(assembly.total_duration_seconds % 60)}s`
                : '—',
              color: 'text-slate-800',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {sceneMap.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Volume2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-500">No audio map yet</p>
          <p className="text-xs mt-1">Run audio assembly to see per-scene status</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-1">
              {(['all', 'ready', 'issues'] as FilterMode[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f === 'all' ? `All (${sceneMap.length})` : f === 'ready' ? 'Ready' : `Issues${issueCount > 0 ? ` (${issueCount})` : ''}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="font-bold text-violet-600">T</span> Transcript</span>
              <span className="flex items-center gap-1"><span className="font-bold text-blue-600">A</span> Audio</span>
              <span className="flex items-center gap-1"><span className="font-bold text-blue-600">C</span> Captions</span>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-x-3 px-4 py-2 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            <div>#</div>
            <div>Scene</div>
            <div className="min-w-[48px]">Bar</div>
            <div>Duration</div>
            <div>Flags</div>
            <div>Asset ID</div>
            <div>Status</div>
          </div>

          <div className="divide-y divide-slate-50">
            {filteredMap.map((record) => (
              <SceneRow
                key={record.scene_id}
                record={record}
                index={sceneMap.indexOf(record)}
                maxDuration={maxDuration}
              />
            ))}
            {filteredMap.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No scenes match this filter</div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
            {Object.entries(STATUS_CONFIG).map(([key, { label, icon }]) => (
              <span key={key} className="flex items-center gap-1">{icon} {label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export { AudioTab };

import { useState } from 'react';
import { Package, Download, RefreshCw, CircleCheck as CheckCircle, Circle as XCircle, Clock, Layers, Mic, FileText, ChevronDown, ChevronRight, CircleAlert as AlertCircle, Activity, ChartBar as BarChart2, GitBranch, Image } from 'lucide-react';
import { useLatestPackage, usePackageHistory, useAssemblePackage } from '../../../hooks/useDocStudioPackage';
import type { PackageListItem } from '../../../hooks/useDocStudioPackage';
import {
  exportTutorialPackageJson,
  exportAssetManifest,
  exportPackageBundle,
} from '../../../services/documentation/packages/exportService';
import { useToast } from '../../../lib/toast';
import type {
  TutorialPackageManifest,
  PackageSceneManifestEntry,
  PackageVariantSummary,
  SceneQualityStatus,
  SceneAudioMapStatus,
  DriftStatus,
  QualityTier,
} from '../../../types/documentation';

interface PackageManifestTabProps {
  draftId: string;
  organizationId: string;
}

const QUALITY_STATUS_CONFIG: Record<SceneQualityStatus, { label: string; color: string }> = {
  pending:      { label: 'Pending',      color: 'bg-slate-100 text-slate-500' },
  good:         { label: 'Good',         color: 'bg-green-100 text-green-700' },
  needs_review: { label: 'Needs review', color: 'bg-amber-100 text-amber-700' },
  incomplete:   { label: 'Incomplete',   color: 'bg-red-100 text-red-600' },
};

const ASSEMBLY_STATUS_CONFIG: Record<SceneAudioMapStatus, { label: string; color: string }> = {
  complete:            { label: 'Complete',    color: 'bg-green-100 text-green-700' },
  audio_ready:         { label: 'Audio ready', color: 'bg-blue-100 text-blue-700' },
  captions_ready:      { label: 'Captions',    color: 'bg-blue-100 text-blue-700' },
  missing_audio:       { label: 'No audio',    color: 'bg-red-100 text-red-600' },
  missing_transcript:  { label: 'No script',   color: 'bg-amber-100 text-amber-700' },
  error:               { label: 'Error',        color: 'bg-red-100 text-red-700' },
  pending:             { label: 'Pending',      color: 'bg-slate-100 text-slate-500' },
};

const DRIFT_STATUS_CONFIG: Record<DriftStatus, { label: string; color: string }> = {
  current:   { label: 'Current',  color: 'text-green-600' },
  warning:   { label: 'Warning',  color: 'text-amber-600' },
  outdated:  { label: 'Outdated', color: 'text-red-600' },
  unknown:   { label: 'Unknown',  color: 'text-slate-400' },
};

const TIER_CONFIG: Record<QualityTier, { label: string; color: string }> = {
  excellent:       { label: 'Excellent',      color: 'bg-green-100 text-green-700' },
  good:            { label: 'Good',           color: 'bg-blue-100 text-blue-700' },
  needs_review:    { label: 'Needs review',   color: 'bg-amber-100 text-amber-700' },
  needs_recapture: { label: 'Needs recapture', color: 'bg-orange-100 text-orange-700' },
  outdated:        { label: 'Outdated',       color: 'bg-red-100 text-red-600' },
  incomplete:      { label: 'Incomplete',     color: 'bg-slate-100 text-slate-600' },
};

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600 w-7 text-right">{score}</span>
    </div>
  );
}

function StatusBadge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function SceneManifestRow({ entry, index }: { entry: PackageSceneManifestEntry; index: number }) {
  const qConfig = QUALITY_STATUS_CONFIG[(entry.quality_status ?? 'pending') as SceneQualityStatus] ?? QUALITY_STATUS_CONFIG.pending;
  const aConfig = ASSEMBLY_STATUS_CONFIG[(entry.assembly_status ?? 'pending') as SceneAudioMapStatus] ?? ASSEMBLY_STATUS_CONFIG.pending;
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-slate-50 rounded-lg">
      <span className="w-5 text-slate-400 text-right shrink-0">{index + 1}</span>
      <span className="flex-1 text-slate-700 truncate">{entry.title}</span>
      <span className={`w-4 flex justify-center ${entry.has_audio ? 'text-blue-500' : 'text-slate-200'}`}>
        <Mic className="w-3 h-3" />
      </span>
      <span className={`w-4 flex justify-center ${entry.has_captions ? 'text-emerald-500' : 'text-slate-200'}`}>
        <FileText className="w-3 h-3" />
      </span>
      <span className={`w-4 flex justify-center ${(entry.screenshot_count ?? 0) > 0 ? 'text-slate-500' : 'text-slate-200'}`}>
        <Image className="w-3 h-3" />
      </span>
      <span className="w-12 text-right text-slate-400 font-mono shrink-0">
        {entry.duration_seconds ? `${entry.duration_seconds.toFixed(1)}s` : '—'}
      </span>
      <StatusBadge className={qConfig.color}>{qConfig.label}</StatusBadge>
      <StatusBadge className={aConfig.color}>{aConfig.label}</StatusBadge>
    </div>
  );
}

function VariantRow({ variant }: { variant: PackageVariantSummary }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-slate-50 rounded-lg">
      <span className="capitalize font-medium text-slate-700 w-20 shrink-0">{variant.role}</span>
      <div className="flex items-center gap-2 flex-1">
        <span className={`flex items-center gap-1 ${variant.has_guide ? 'text-blue-600' : 'text-slate-200'}`}>
          <FileText className="w-3 h-3" />
          <span className={variant.has_guide ? '' : 'opacity-0'}>Guide</span>
        </span>
        <span className={`flex items-center gap-1 ${variant.has_narration_script ? 'text-blue-600' : 'text-slate-200'}`}>
          <Mic className="w-3 h-3" />
          <span className={variant.has_narration_script ? '' : 'opacity-0'}>Script</span>
        </span>
      </div>
      <span className="text-slate-500">{variant.key_tips_count} tips</span>
      <span className="text-slate-400">{new Date(variant.generated_at ?? '').toLocaleDateString()}</span>
    </div>
  );
}

function HistoryRow({ pkg, isLatest }: { pkg: PackageListItem; isLatest: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs text-slate-600 border-b last:border-0 border-slate-50">
      {isLatest && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Latest</span>}
      <span className="text-slate-500 shrink-0">{new Date(pkg.exported_at).toLocaleDateString()}</span>
      <span className="flex-1">{pkg.scene_count} scenes</span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        pkg.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}>
        {pkg.status}
      </span>
    </div>
  );
}

export default function PackageManifestTab({ draftId, organizationId }: PackageManifestTabProps) {
  const toast = useToast();
  const [scenesOpen, setScenesOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: packageExport, isLoading } = useLatestPackage(draftId);
  const { data: history } = usePackageHistory(draftId);
  const assemblePackage = useAssemblePackage(draftId);

  const manifest = packageExport?.manifest_json as TutorialPackageManifest | undefined;

  async function handleRebuildPackage() {
    try {
      await assemblePackage.mutateAsync({ organizationId });
      toast.showToast('Package rebuilt', 'success');
    } catch (e) {
      toast.showToast(String(e), 'error');
    }
  }

  function handleExportJSON() {
    if (!manifest) return;
    exportTutorialPackageJson(manifest);
  }

  function handleExportAssets() {
    if (!manifest) return;
    exportAssetManifest(manifest as Parameters<typeof exportAssetManifest>[0]);
  }

  function handleExportBundle() {
    if (!manifest) return;
    exportPackageBundle(manifest as Parameters<typeof exportPackageBundle>[0]);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading package…
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Package className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium text-slate-500">No package assembled yet</p>
        <p className="text-xs mt-1 mb-4">Run the full assembly pipeline to generate a tutorial package</p>
        <button
          onClick={handleRebuildPackage}
          disabled={assemblePackage.isPending}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {assemblePackage.isPending ? 'Building…' : 'Build Package'}
        </button>
      </div>
    );
  }

  const tierConfig = TIER_CONFIG[(manifest.quality_tier ?? 'incomplete') as QualityTier] ?? TIER_CONFIG.incomplete;
  const driftConfig = DRIFT_STATUS_CONFIG[manifest.drift_summary?.overall_status ?? 'unknown'] ?? DRIFT_STATUS_CONFIG.unknown;
  const totalMin = Math.floor((manifest.total_duration_seconds ?? 0) / 60);
  const totalSec = Math.round((manifest.total_duration_seconds ?? 0) % 60);

  const qualityDimensions = [
    { label: 'Overall',               score: manifest.quality_summary?.overall_score ?? 0 },
    { label: 'Audio completeness',     score: manifest.quality_summary?.audio_completeness ?? 0 },
    { label: 'Caption coverage',       score: manifest.quality_summary?.caption_coverage ?? 0 },
    { label: 'Timing manifest',        score: manifest.quality_summary?.timing_manifest_completeness ?? 0 },
    { label: 'Package assembly',       score: manifest.quality_summary?.package_assembly_completeness ?? 0 },
    { label: 'Export readiness',       score: manifest.quality_summary?.export_readiness ?? 0 },
  ];

  const timingMs = manifest.timing_manifest?.total_duration_ms ?? 0;
  const assemblyPct = manifest.quality_summary?.package_assembly_completeness ?? 0;

  const readinessChecks = [
    { label: 'Has scenes',             passed: (manifest.scene_count ?? 0) > 0,               detail: `${manifest.scene_count ?? 0} scene(s)` },
    { label: 'Audio coverage ≥ 80%',   passed: manifest.audio_coverage_pct >= 80,      detail: `${manifest.audio_coverage_pct}%` },
    { label: 'Caption coverage ≥ 60%', passed: manifest.caption_coverage_pct >= 60,    detail: `${manifest.caption_coverage_pct}%` },
    { label: 'Timing manifest',        passed: timingMs > 0,                            detail: timingMs > 0 ? `${Math.round(timingMs / 1000)}s total` : 'Not yet generated' },
    { label: 'Assembly complete',      passed: assemblyPct >= 100,                      detail: assemblyPct >= 100 ? 'All pipeline steps complete' : `${assemblyPct}% of steps complete` },
    { label: 'Quality score ≥ 60',     passed: (manifest.quality_summary?.overall_score ?? 0) >= 60, detail: `${manifest.quality_summary?.overall_score ?? 0}/100` },
    { label: 'No drift warnings',      passed: manifest.drift_summary?.warning_count === 0, detail: `${manifest.drift_summary?.warning_count ?? 0} warning(s)` },
    { label: 'No outdated content',    passed: manifest.drift_summary?.outdated_count === 0, detail: `${manifest.drift_summary?.outdated_count ?? 0} outdated` },
  ];
  const passedCount = readinessChecks.filter(c => c.passed).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-slate-800">{manifest.title}</h3>
            <StatusBadge className={tierConfig.color}>{tierConfig.label}</StatusBadge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{manifest.version_label}</span>
            <span>·</span>
            <span className="capitalize">{manifest.output_type?.replace(/_/g, ' ')}</span>
            {manifest.target_role && <><span>·</span><span className="capitalize">{manifest.target_role}</span></>}
            {manifest.tutorial_group && <><span>·</span><span>{manifest.tutorial_group}</span></>}
            <span>·</span>
            <span>{new Date(manifest.assembled_at ?? '').toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRebuildPackage}
            disabled={assemblePackage.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${assemblePackage.isPending ? 'animate-spin' : ''}`} />
            Rebuild
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden hidden group-hover:block">
              <button onClick={handleExportJSON} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-blue-500" /> Package JSON
              </button>
              <button onClick={handleExportAssets} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-slate-400" /> Asset Manifest
              </button>
              <button onClick={handleExportBundle} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
                <Download className="w-3.5 h-3.5 text-slate-500" /> Full Bundle
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { icon: <Layers className="w-4 h-4 text-slate-400" />, value: manifest.scene_count, label: 'Scenes' },
          { icon: <Mic className="w-4 h-4 text-blue-500" />, value: `${manifest.audio_coverage_pct}%`, label: 'Audio' },
          { icon: <FileText className="w-4 h-4 text-emerald-500" />, value: `${manifest.caption_coverage_pct}%`, label: 'Captions' },
          { icon: <Clock className="w-4 h-4 text-amber-500" />, value: `${totalMin}m ${totalSec}s`, label: 'Runtime' },
          { icon: <Activity className="w-4 h-4 text-violet-500" />, value: manifest.narration_segment_count ?? '—', label: 'Segments' },
          { icon: <FileText className="w-4 h-4 text-blue-500" />, value: manifest.caption_block_count ?? '—', label: 'Captions' },
        ].map(({ icon, value, label }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
            <div className="flex justify-center mb-1">{icon}</div>
            <div className="text-lg font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-blue-500" /> Quality Scores
            </h4>
            <StatusBadge className={tierConfig.color}>{tierConfig.label}</StatusBadge>
          </div>
          <div className="space-y-2.5">
            {qualityDimensions.map(({ label, score }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
                <ScoreBar score={score} />
              </div>
            ))}
          </div>
          {(manifest.quality_summary?.warning_count ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {manifest.quality_summary.warning_count} warning(s)
              {(manifest.quality_summary.critical_warning_count ?? 0) > 0 && (
                <span className="ml-1 text-red-600 font-medium">
                  · {manifest.quality_summary.critical_warning_count} critical
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Package Readiness
              </h4>
              <span className={`text-xs font-medium ${passedCount === readinessChecks.length ? 'text-green-600' : 'text-amber-600'}`}>
                {passedCount}/{readinessChecks.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {readinessChecks.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {item.passed
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <span className="text-xs text-slate-700 flex-1">{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {manifest.drift_summary && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-slate-400" /> Drift Summary
                </h4>
                <span className={`text-xs font-medium ${driftConfig.color}`}>{driftConfig.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Checks',   value: manifest.drift_summary.total_checks },
                  { label: 'Current',  value: manifest.drift_summary.current_count,  color: 'text-green-600' },
                  { label: 'Warnings', value: manifest.drift_summary.warning_count,  color: manifest.drift_summary.warning_count > 0 ? 'text-amber-600' : 'text-slate-400' },
                  { label: 'Outdated', value: manifest.drift_summary.outdated_count, color: manifest.drift_summary.outdated_count > 0 ? 'text-red-600' : 'text-slate-400' },
                ].map(({ label, value, color = 'text-slate-700' }) => (
                  <div key={label}>
                    <div className={`text-base font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
          onClick={() => setScenesOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Scene Manifest ({manifest.scenes.length} scenes)
          </div>
          {scenesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {scenesOpen && (
          <div className="border-t border-slate-100 px-2 py-2">
            <div className="flex items-center gap-3 px-3 py-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
              <span className="w-5 text-right">#</span>
              <span className="flex-1">Scene</span>
              <span title="Audio"><Mic className="w-3 h-3" /></span>
              <span title="Captions"><FileText className="w-3 h-3" /></span>
              <span title="Screenshots"><Image className="w-3 h-3" /></span>
              <span className="w-12 text-right">Dur.</span>
              <span className="w-14 text-right">Quality</span>
              <span className="w-14 text-right">Assembly</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {manifest.scenes.map((entry, i) => (
                <SceneManifestRow key={entry.scene_id} entry={entry} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {manifest.variants && manifest.variants.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
            onClick={() => setVariantsOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-slate-400" />
              Role Variants ({manifest.variants.length})
            </div>
            {variantsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {variantsOpen && (
            <div className="border-t border-slate-100 px-2 py-2">
              <div className="flex items-center gap-3 px-3 py-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
                <span className="w-20">Role</span>
                <span className="flex-1">Assets</span>
                <span>Tips</span>
                <span>Generated</span>
              </div>
              {manifest.variants.map((v, i) => (
                <VariantRow key={i} variant={v} />
              ))}
            </div>
          )}
        </div>
      )}

      {history && history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
            onClick={() => setHistoryOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              Build History ({history.length})
            </div>
            {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {historyOpen && (
            <div className="border-t border-slate-100 divide-y divide-slate-50">
              {history.map((pkg, i) => (
                <HistoryRow key={pkg.id} pkg={pkg} isLatest={i === 0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export { PackageManifestTab };

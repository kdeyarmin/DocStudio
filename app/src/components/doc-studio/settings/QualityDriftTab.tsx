import { useState } from 'react';
import { Save, Loader as Loader2, Star, ShieldCheck } from 'lucide-react';
import {
  useQualitySettingsConfig,
  useSaveQualitySettingsConfig,
  useDriftSettingsConfig,
  useSaveDriftSettingsConfig,
} from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { QualitySettingsConfig, DriftSettingsConfig } from '../../../types/documentation';
import { DEFAULT_QUALITY_SETTINGS_CONFIG, DEFAULT_DRIFT_SETTINGS_CONFIG } from '../../../types/documentation';

export function QualityDriftTab() {
  const { showToast } = useToast();

  const { data: qualityData, isLoading: qualityLoading, refetch: refetchQuality } = useQualitySettingsConfig();
  const { data: driftData, isLoading: driftLoading, refetch: refetchDrift } = useDriftSettingsConfig();
  const saveQuality = useSaveQualitySettingsConfig();
  const saveDrift = useSaveDriftSettingsConfig();

  const [localQuality, setQuality] = useState<QualitySettingsConfig | null>(null);
  const [localDrift, setDrift] = useState<DriftSettingsConfig | null>(null);
  const quality = localQuality ?? qualityData ?? DEFAULT_QUALITY_SETTINGS_CONFIG;
  const drift = localDrift ?? driftData ?? DEFAULT_DRIFT_SETTINGS_CONFIG;

  const updateQuality = (patch: Partial<QualitySettingsConfig>) => setQuality((prev) => ({ ...(prev ?? quality), ...patch }));
  const updateDrift = (patch: Partial<DriftSettingsConfig>) => setDrift((prev) => ({ ...(prev ?? drift), ...patch }));

  const handleSaveQuality = async () => {
    try {
      await saveQuality.mutateAsync(quality);
      const refreshed = await refetchQuality();
      if (!refreshed.error) setQuality(current => current === localQuality ? null : current);
      showToast('Quality settings saved', 'success');
    } catch {
      showToast('Failed to save quality settings', 'error');
    }
  };

  const handleSaveDrift = async () => {
    try {
      await saveDrift.mutateAsync(drift);
      const refreshed = await refetchDrift();
      if (!refreshed.error) setDrift(current => current === localDrift ? null : current);
      showToast('Drift settings saved', 'success');
    } catch {
      showToast('Failed to save drift settings', 'error');
    }
  };

  if (qualityLoading || driftLoading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Quality Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg"><Star size={16} className="text-amber-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Quality Score Thresholds</h3>
            <p className="text-xs text-slate-400 mt-0.5">Set minimum requirements and tier boundaries for guide quality scoring.</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score Tiers</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Excellent (min %)</span>
              </label>
              <input type="number" min={50} max={100} value={quality.excellent_threshold}
                onChange={(e) => updateQuality({ excellent_threshold: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Good (min %)</span>
              </label>
              <input type="number" min={40} max={100} value={quality.good_threshold}
                onChange={(e) => updateQuality({ good_threshold: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Needs Review (min %)</span>
              </label>
              <input type="number" min={0} max={100} value={quality.needs_review_threshold}
                onChange={(e) => updateQuality({ needs_review_threshold: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Coverage Requirements</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Min Screenshot Coverage (%)</label>
              <input type="number" min={0} max={100} value={quality.min_screenshot_coverage_pct}
                onChange={(e) => updateQuality({ min_screenshot_coverage_pct: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-slate-400 mt-0.5">Minimum % of steps that need a screenshot</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Min Hero Screenshots</label>
              <input type="number" min={0} max={20} value={quality.min_hero_screenshot_count}
                onChange={(e) => updateQuality({ min_hero_screenshot_count: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Drift Warning After (days)</label>
              <input type="number" min={1} max={365} value={quality.drift_warning_threshold_days}
                onChange={(e) => updateQuality({ drift_warning_threshold_days: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Auto-flag for Review if Score Below</label>
              <input type="number" min={0} max={100} value={quality.auto_mark_review_if_score_below}
                onChange={(e) => updateQuality({ auto_mark_review_if_score_below: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {([
              ['transcript_required', 'Transcript required for passing'],
              ['narration_required', 'Narration required for passing'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={quality[key]} onChange={(e) => updateQuality({ [key]: e.target.checked })} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSaveQuality} disabled={saveQuality.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saveQuality.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Quality Settings
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200" />

      {/* Drift Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 rounded-lg"><ShieldCheck size={16} className="text-rose-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Screenshot Drift Detection</h3>
            <p className="text-xs text-slate-400 mt-0.5">Configure when and how screenshots are flagged as potentially outdated.</p>
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={drift.drift_tracking_enabled} onChange={(e) => updateDrift({ drift_tracking_enabled: e.target.checked })} className="rounded border-slate-300" />
            Enabled
          </label>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Comparison Sensitivity</label>
              <select value={drift.comparison_sensitivity} onChange={(e) => updateDrift({ comparison_sensitivity: e.target.value as DriftSettingsConfig['comparison_sensitivity'] })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low (major changes only)</option>
                <option value="medium">Medium (balanced)</option>
                <option value="high">High (any change)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Revalidation Interval (days)</label>
              <input type="number" min={7} max={365} value={drift.revalidation_interval_days}
                onChange={(e) => updateDrift({ revalidation_interval_days: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {([
              ['hero_screenshot_baseline_auto', 'Auto-set hero screenshots as baseline'],
              ['manual_validation_required', 'Require manual validation to clear drift warnings'],
              ['auto_flag_after_major_release', 'Auto-flag all guides after major release'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={drift[key]} onChange={(e) => updateDrift({ [key]: e.target.checked })} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSaveDrift} disabled={saveDrift.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saveDrift.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Drift Settings
          </button>
        </div>
      </div>
    </div>
  );
}

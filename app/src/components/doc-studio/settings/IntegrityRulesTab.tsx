import { useState } from 'react';
import { Save, Loader as Loader2, ShieldCheck, RotateCcw } from 'lucide-react';
import { useIntegrityRulesConfig, useSaveIntegrityRulesConfig } from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { IntegrityRulesConfig } from '../../../types/documentation';
import { DEFAULT_INTEGRITY_RULES_CONFIG } from '../../../types/documentation';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700 leading-snug">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

function NumberField({ label, description, value, onChange, min = 0, max = 1000, step = 1, suffix }: NumberFieldProps) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-0.5 block">{label}</label>
      <p className="text-xs text-slate-400 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || min)}
          className="w-28 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

export function IntegrityRulesTab() {
  const { showToast } = useToast();
  const { data, isLoading, refetch } = useIntegrityRulesConfig();
  const save = useSaveIntegrityRulesConfig();
  const [local, setForm] = useState<IntegrityRulesConfig | null>(null);
  const form = local ?? data ?? DEFAULT_INTEGRITY_RULES_CONFIG;
  const update = (patch: Partial<IntegrityRulesConfig>) => setForm((prev) => ({ ...(prev ?? form), ...patch }));

  const handleReset = () => setForm(DEFAULT_INTEGRITY_RULES_CONFIG);

  const handleSave = async () => {
    try {
      await save.mutateAsync(form);
      const refreshed = await refetch();
      if (!refreshed.error) setForm(current => current === local ? null : current);
      showToast('Integrity rules saved', 'success');
    } catch {
      showToast('Failed to save integrity rules', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5">

      {/* Requirements */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3 mb-1">
          <div className="p-2 bg-blue-50 rounded-lg"><ShieldCheck size={16} className="text-blue-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Validation Requirements</h3>
            <p className="text-xs text-slate-400 mt-0.5">Define what a draft must have before it can pass an integrity check.</p>
          </div>
        </div>

        <div className="space-y-4">
          <ToggleRow
            label="Require shot plans for all scenes"
            description="Fail the check if any scene has no shot plans assigned."
            checked={form.require_all_scenes_have_shots}
            onChange={(v) => update({ require_all_scenes_have_shots: v })}
          />
          <ToggleRow
            label="Require narration for all scenes"
            description="Fail if any scene has no narration segment."
            checked={form.require_narration_for_all_scenes}
            onChange={(v) => update({ require_narration_for_all_scenes: v })}
          />
          <ToggleRow
            label="Require captions for all scenes"
            description="Fail if the caption manifest is missing or incomplete."
            checked={form.require_captions_for_all_scenes}
            onChange={(v) => update({ require_captions_for_all_scenes: v })}
          />
          <ToggleRow
            label="Require hero screenshot per scene"
            description="Fail if any scene has no associated screenshot asset."
            checked={form.require_hero_screenshot_per_scene}
            onChange={(v) => update({ require_hero_screenshot_per_scene: v })}
          />
        </div>
      </div>

      {/* Blocking failures */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Blocking Failure Rules</h3>
        <p className="text-xs text-slate-400 -mt-2">
          When enabled, these failures cause the overall status to become <span className="font-semibold text-red-600">Failed Validation</span> regardless of score.
        </p>
        <div className="space-y-4">
          <ToggleRow
            label="Fail on missing shot plans"
            description="Mark failed_validation when shot plans are absent."
            checked={form.fail_on_missing_shot_plans}
            onChange={(v) => update({ fail_on_missing_shot_plans: v })}
          />
          <ToggleRow
            label="Fail on missing captions"
            description="Mark failed_validation when caption manifest is absent."
            checked={form.fail_on_missing_captions}
            onChange={(v) => update({ fail_on_missing_captions: v })}
          />
          <ToggleRow
            label="Fail on outdated drift"
            description="Mark failed_validation when last capture exceeds the max acceptable drift age."
            checked={form.fail_on_outdated_drift}
            onChange={(v) => update({ fail_on_outdated_drift: v })}
          />
        </div>
      </div>

      {/* Score thresholds */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Score Thresholds</h3>
        <div className="grid grid-cols-2 gap-6">
          <NumberField
            label="Minimum score for Healthy status"
            description="Drafts scoring at or above this threshold are considered healthy."
            value={form.min_overall_score_for_healthy}
            onChange={(v) => update({ min_overall_score_for_healthy: Math.min(100, Math.max(1, v)) })}
            min={1}
            max={100}
            suffix="/ 100"
          />
          <NumberField
            label="Minimum score for Warning status"
            description="Drafts between this and the healthy threshold get a warning status."
            value={form.min_overall_score_for_warning}
            onChange={(v) => update({ min_overall_score_for_warning: Math.min(99, Math.max(1, v)) })}
            min={1}
            max={99}
            suffix="/ 100"
          />
          <NumberField
            label="Minimum scene count"
            description="Drafts with fewer scenes than this will be flagged."
            value={form.min_scene_count}
            onChange={(v) => update({ min_scene_count: Math.max(1, v) })}
            min={1}
            max={100}
            suffix="scenes"
          />
          <NumberField
            label="Max acceptable drift age"
            description="Drafts not recaptured within this period are considered outdated."
            value={form.max_acceptable_drift_days}
            onChange={(v) => update({ max_acceptable_drift_days: Math.max(1, v) })}
            min={1}
            max={3650}
            suffix="days"
          />
        </div>
      </div>

      {/* Automation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Automation</h3>
        <ToggleRow
          label="Auto-run integrity check on job completion"
          description="Automatically run a full integrity check whenever a Playwright job finishes."
          checked={form.auto_run_on_job_complete}
          onChange={(v) => update({ auto_run_on_job_complete: v })}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={12} />
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={save.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Rules
        </button>
      </div>
    </div>
  );
}

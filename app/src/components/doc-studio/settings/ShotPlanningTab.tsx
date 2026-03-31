import { useState, useEffect } from 'react';
import { Save, Loader as Loader2, Film } from 'lucide-react';
import { useShotPlanningConfig, useSaveShotPlanningConfig } from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type {
  ShotPlanningConfig,
  ShotType,
  ShotPacingMode,
  ShotTransition,
  ShotEmphasisLevel,
} from '../../../types/documentation';
import {
  DEFAULT_SHOT_PLANNING_CONFIG,
  SHOT_TYPE_LABELS,
  SHOT_PACING_LABELS,
} from '../../../types/documentation';

const SHOT_TYPE_OPTIONS: { value: ShotType; label: string }[] = (
  Object.entries(SHOT_TYPE_LABELS) as [ShotType, string][]
).map(([value, label]) => ({ value, label }));

const PACING_OPTIONS: { value: ShotPacingMode; label: string }[] = (
  Object.entries(SHOT_PACING_LABELS) as [ShotPacingMode, string][]
).map(([value, label]) => ({ value, label }));

const TRANSITION_OPTIONS: { value: ShotTransition; label: string }[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'none', label: 'None' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade_to_black', label: 'Fade to Black' },
  { value: 'fade_from_black', label: 'Fade from Black' },
  { value: 'slide_left', label: 'Slide Left' },
  { value: 'slide_right', label: 'Slide Right' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'zoom_in', label: 'Zoom In' },
  { value: 'zoom_out', label: 'Zoom Out' },
];

const EMPHASIS_OPTIONS: { value: ShotEmphasisLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function ShotPlanningTab() {
  const { showToast } = useToast();
  const { data, isLoading } = useShotPlanningConfig();
  const save = useSaveShotPlanningConfig();
  const [form, setForm] = useState<ShotPlanningConfig>(DEFAULT_SHOT_PLANNING_CONFIG);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const update = (patch: Partial<ShotPlanningConfig>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(form);
      showToast('Shot planning settings saved', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Film size={16} className="text-blue-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Shot Plan Defaults</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control how shot plans are auto-generated for new scenes and what defaults are applied.
            </p>
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={form.auto_generate_on_scene_creation}
              onChange={(e) => update({ auto_generate_on_scene_creation: e.target.checked })}
              className="rounded border-slate-300"
            />
            Auto-generate on scene creation
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Shot Type</label>
            <select
              value={form.default_shot_type}
              onChange={(e) => update({ default_shot_type: e.target.value as ShotType })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SHOT_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Pacing Mode</label>
            <select
              value={form.default_pacing_mode}
              onChange={(e) => update({ default_pacing_mode: e.target.value as ShotPacingMode })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PACING_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Transition In</label>
            <select
              value={form.default_transition_in}
              onChange={(e) => update({ default_transition_in: e.target.value as ShotTransition })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TRANSITION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Transition Out</label>
            <select
              value={form.default_transition_out}
              onChange={(e) => update({ default_transition_out: e.target.value as ShotTransition })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TRANSITION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Emphasis Level</label>
            <select
              value={form.default_emphasis_level}
              onChange={(e) => update({ default_emphasis_level: e.target.value as ShotEmphasisLevel })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EMPHASIS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Default Transition Duration (seconds)
            </label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={form.default_transition_duration}
              onChange={(e) => update({ default_transition_duration: parseFloat(e.target.value) || 0.5 })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Shot Constraints</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Min Shots per Scene</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.min_shots_per_scene}
                onChange={(e) => update({ min_shots_per_scene: parseInt(e.target.value, 10) || 1 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Max Shots per Scene</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.max_shots_per_scene}
                onChange={(e) => update({ max_shots_per_scene: parseInt(e.target.value, 10) || 8 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.enable_key_shot_tagging}
              onChange={(e) => update({ enable_key_shot_tagging: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span className="text-slate-600">Enable key shot tagging</span>
            <span className="text-xs text-slate-400 ml-1">(marks the most important shot per scene)</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={save.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

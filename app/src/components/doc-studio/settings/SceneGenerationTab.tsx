import { useState, useEffect } from 'react';
import { Save, Loader as Loader2, Layers } from 'lucide-react';
import { useSceneGenerationConfig, useSaveSceneGenerationConfig } from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { SceneGenerationConfig } from '../../../types/documentation';
import { DEFAULT_SCENE_GENERATION_CONFIG } from '../../../types/documentation';

export function SceneGenerationTab() {
  const { showToast } = useToast();
  const { data, isLoading } = useSceneGenerationConfig();
  const save = useSaveSceneGenerationConfig();
  const [form, setForm] = useState<SceneGenerationConfig>(DEFAULT_SCENE_GENERATION_CONFIG);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const update = (patch: Partial<SceneGenerationConfig>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(form);
      showToast('Scene generation settings saved', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Layers size={16} className="text-blue-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">Scene Assembly</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controls how individual workflow steps are grouped into scenes for guide generation and narration.
            </p>
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={form.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="rounded border-slate-300" />
            Enabled
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Default Grouping Mode</label>
            <select value={form.default_grouping_mode} onChange={(e) => update({ default_grouping_mode: e.target.value as SceneGenerationConfig['default_grouping_mode'] })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="auto">Auto (smart grouping)</option>
              <option value="step_count">By step count</option>
              <option value="manual">Manual only</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Max Steps per Scene</label>
            <input type="number" min={1} max={20} value={form.max_steps_per_scene} onChange={(e) => update({ max_steps_per_scene: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Min Scene Duration (seconds)</label>
            <input type="number" min={1} max={60} value={form.min_scene_duration_seconds} onChange={(e) => update({ min_scene_duration_seconds: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Max Scenes per Tutorial</label>
            <input type="number" min={1} max={50} value={form.max_scenes_per_tutorial} onChange={(e) => update({ max_scenes_per_tutorial: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="font-medium text-slate-700 text-sm">Auto-Split Triggers</h3>
        <p className="text-xs text-slate-500">Automatically start a new scene when these events occur in the workflow.</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['split_on_major_navigation', 'Major page navigation'],
            ['split_on_form_submission', 'Form submission'],
            ['split_on_modal_open', 'Modal opens'],
            ['split_on_modal_close', 'Modal closes'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <input type="checkbox" checked={form[key]} onChange={(e) => update({ [key]: e.target.checked })} className="rounded border-slate-300" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={save.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Scene Settings
        </button>
      </div>
    </div>
  );
}

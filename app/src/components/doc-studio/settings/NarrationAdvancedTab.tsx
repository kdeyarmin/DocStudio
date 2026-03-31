import { useState, useEffect } from 'react';
import { Save, Loader as Loader2, Mic as Mic2 } from 'lucide-react';
import { useNarrationAdvancedConfig, useSaveNarrationAdvancedConfig } from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { NarrationAdvancedConfig, NarrationStyle } from '../../../types/documentation';
import { DEFAULT_NARRATION_ADVANCED_CONFIG } from '../../../types/documentation';

const NARRATION_STYLES: { value: NarrationStyle; label: string; desc: string }[] = [
  { value: 'instructional', label: 'Instructional', desc: 'Clear, step-by-step guidance tone' },
  { value: 'conversational', label: 'Conversational', desc: 'Friendly, natural-sounding delivery' },
  { value: 'formal', label: 'Formal', desc: 'Professional and authoritative' },
  { value: 'concise', label: 'Concise', desc: 'Minimal words, maximum clarity' },
];

export function NarrationAdvancedTab() {
  const { showToast } = useToast();
  const { data, isLoading } = useNarrationAdvancedConfig();
  const save = useSaveNarrationAdvancedConfig();
  const [form, setForm] = useState<NarrationAdvancedConfig>(DEFAULT_NARRATION_ADVANCED_CONFIG);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const update = (patch: Partial<NarrationAdvancedConfig>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      await save.mutateAsync(form);
      showToast('Narration settings saved', 'success');
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
          <div className="p-2 bg-emerald-50 rounded-lg"><Mic2 size={16} className="text-emerald-600" /></div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-700 text-sm">Narration Pipeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">Controls how narration scripts are generated and structured per scene.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={form.narration_enabled} onChange={(e) => update({ narration_enabled: e.target.checked })} className="rounded border-slate-300" />
            Enabled
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Duration Strategy</label>
            <select value={form.duration_strategy} onChange={(e) => update({ duration_strategy: e.target.value as NarrationAdvancedConfig['duration_strategy'] })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="natural">Natural (follows text length)</option>
              <option value="target">Target WPM</option>
              <option value="strict">Strict (match scene duration)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Target Speech Pace (WPM)</label>
            <input type="number" min={80} max={220} value={form.target_speech_pace_wpm} onChange={(e) => update({ target_speech_pace_wpm: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-slate-400 mt-0.5">Typical range: 120–160 WPM</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Max Segment Duration (seconds)</label>
            <input type="number" min={10} max={120} value={form.max_segment_duration_seconds} onChange={(e) => update({ max_segment_duration_seconds: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Default Style</h3>
        <div className="grid grid-cols-2 gap-2">
          {NARRATION_STYLES.map((s) => (
            <label key={s.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              form.style_default === s.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input type="radio" name="style_default" value={s.value} checked={form.style_default === s.value}
                onChange={() => update({ style_default: s.value })} className="mt-0.5 border-slate-300" />
              <div>
                <div className="text-sm font-medium text-slate-700">{s.label}</div>
                <div className="text-xs text-slate-400">{s.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="font-medium text-slate-700 text-sm">Generation Options</h3>
        <div className="space-y-2">
          {([
            ['per_scene_narration', 'Generate separate narration per scene', 'Each scene gets its own narration segment'],
            ['generate_concise_variant', 'Generate concise variant', 'Shorter version alongside the main script'],
            ['generate_alternate_wording', 'Generate alternate wording', 'Alternative phrasings for A/B testing'],
            ['apply_pronunciation_dictionary', 'Apply pronunciation dictionary', 'Substitute terms using your pronunciation rules'],
          ] as const).map(([key, label, desc]) => (
            <label key={key} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" checked={form[key]} onChange={(e) => update({ [key]: e.target.checked })} className="rounded border-slate-300 mt-0.5" />
              <div>
                <div className="text-sm text-slate-700">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={save.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Narration Settings
        </button>
      </div>
    </div>
  );
}

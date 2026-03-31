import { useState, useEffect } from 'react';
import { Save, Loader as Loader2 } from 'lucide-react';
import { usePlaywrightSettings, useSavePlaywrightSettings } from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import type { PlaywrightSettings } from '../../../types/documentation';
import { DEFAULT_PLAYWRIGHT_SETTINGS } from '../../../types/documentation';

export function PlaywrightConfigTab() {
  const { showToast } = useToast();
  const { data: settings, isLoading } = usePlaywrightSettings();
  const saveSettings = useSavePlaywrightSettings();
  const [form, setForm] = useState<PlaywrightSettings>(DEFAULT_PLAYWRIGHT_SETTINGS);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const update = (patch: Partial<PlaywrightSettings>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      await saveSettings.mutateAsync(form);
      showToast('Settings saved', 'success');
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
        <h3 className="font-medium text-slate-700 text-sm">Provider</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Active Provider</label>
            <select value={form.provider_active} onChange={(e) => update({ provider_active: e.target.value as PlaywrightSettings['provider_active'] })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="mock">Mock (simulated)</option>
              <option value="playwright">Playwright (real browser)</option>
            </select>
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.playwright_enabled} onChange={(e) => update({ playwright_enabled: e.target.checked })} className="rounded border-slate-300" />
              Enable Playwright
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Runner Connection</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Playwright Runner URL</label>
            <input value={form.playwright_runner_url} onChange={(e) => update({ playwright_runner_url: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://runner.caremetric.ai" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Base URL</label>
            <input value={form.playwright_base_url} onChange={(e) => update({ playwright_base_url: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://app.caremetric.ai" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Login Path</label>
            <input value={form.playwright_login_path} onChange={(e) => update({ playwright_login_path: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/login" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-slate-700 text-sm">Viewport & Recording</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Width</label>
            <input type="number" value={form.viewport_width} onChange={(e) => update({ viewport_width: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Height</label>
            <input type="number" value={form.viewport_height} onChange={(e) => update({ viewport_height: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Step Timeout (ms)</label>
            <input type="number" value={form.step_timeout_ms} onChange={(e) => update({ step_timeout_ms: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          {([
            ['headless', 'Headless mode'],
            ['trace_enabled', 'Enable tracing'],
            ['screenshots_enabled', 'Enable screenshots'],
            ['video_enabled', 'Enable video'],
            ['retain_partial_assets_on_failure', 'Keep assets on failure'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form[key] as boolean} onChange={(e) => update({ [key]: e.target.checked })} className="rounded border-slate-300" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saveSettings.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saveSettings.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Save, Loader as Loader2, Film, Captions, Megaphone, ArrowRightLeft, RotateCcw, Cpu, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Gauge } from 'lucide-react';
import { useRenderSettingsConfig, useSaveRenderSettingsConfig } from '../../../hooks/useDocStudioSettings';
import { useToast } from '../../../lib/toast';
import {
  DEFAULT_RENDER_SETTINGS,
  RENDER_MODE_LABELS,
  RENDER_MODE_DESCRIPTIONS,
  RENDER_ENGINE_CAPABILITIES,
} from '../../../types/documentation';
import type { RenderSettings, RenderMode, RenderEngineProvider } from '../../../types/documentation';

const QUALITY_PRESETS: Array<{ label: string; bitrate: number; desc: string }> = [
  { label: 'Low', bitrate: 1500, desc: 'Smallest file size, 720p-friendly' },
  { label: 'Medium', bitrate: 4000, desc: 'Balanced quality and size' },
  { label: 'High', bitrate: 8000, desc: 'Sharp 1080p output' },
  { label: 'Max', bitrate: 20000, desc: 'Near-lossless, largest file' },
];

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <span className="text-slate-500">{icon}</span>
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 font-medium">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function RenderSettingsTab() {
  const { showToast } = useToast();
  const { data: rawSettings, isLoading } = useRenderSettingsConfig();
  const { mutateAsync: saveSettings, isPending: saving } = useSaveRenderSettingsConfig();

  const currentSettings: RenderSettings = rawSettings ?? DEFAULT_RENDER_SETTINGS;
  const [local, setLocal] = useState<RenderSettings | null>(null);
  const settings = local ?? currentSettings;

  const update = (patch: Partial<RenderSettings>) => setLocal({ ...settings, ...patch });

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      setLocal(null);
      showToast('Render settings saved', 'success');
    } catch {
      showToast('Failed to save render settings', 'error');
    }
  };

  const handleReset = () => {
    setLocal({ ...DEFAULT_RENDER_SETTINGS });
    showToast('Reset to defaults (not saved)', 'info');
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Render Configuration</p>
          <p className="text-xs text-slate-400 mt-0.5">Default settings for tutorial video rendering</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={13} />
            Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !local}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>

      <Section title="Engine Provider" icon={<Cpu size={14} />}>
        <p className="text-xs text-slate-500 -mt-1 mb-3">Available render engines for new jobs. Engine is selected per-job at render time.</p>
        <div className="space-y-2">
          {(Object.keys(RENDER_ENGINE_CAPABILITIES) as RenderEngineProvider[]).map(provider => {
            const cap = RENDER_ENGINE_CAPABILITIES[provider];
            return (
              <div key={provider} className={`flex items-start gap-3 p-3 rounded-xl border ${cap.available ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-800">{cap.label}</span>
                    {cap.available
                      ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full"><CheckCircle2 size={9} /> Available</span>
                      : <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full"><AlertCircle size={9} /> Coming Soon</span>
                    }
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {cap.supports_burn_in_captions && <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">Burn-in captions</span>}
                    {cap.supports_callout_overlays && <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">Callout overlays</span>}
                    {cap.supports_zoom_effects && <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">Zoom effects</span>}
                    {cap.supports_4k && <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">4K support</span>}
                    <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">{cap.estimated_speed_multiplier}x speed</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Default Render Mode" icon={<Film size={14} />}>
        <div className="grid grid-cols-1 gap-2">
          {(Object.keys(RENDER_MODE_LABELS) as RenderMode[]).map((mode) => (
            <label
              key={mode}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                settings.default_render_mode === mode
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="render_mode"
                value={mode}
                checked={settings.default_render_mode === mode}
                onChange={() => update({ default_render_mode: mode })}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{RENDER_MODE_LABELS[mode]}</p>
                <p className="text-xs text-slate-500 mt-0.5">{RENDER_MODE_DESCRIPTIONS[mode]}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Video Output" icon={<Film size={14} />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Width (px)</label>
            <input
              type="number"
              value={settings.default_video_config.width}
              onChange={e => update({ default_video_config: { ...settings.default_video_config, width: Number(e.target.value) } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Height (px)</label>
            <input
              type="number"
              value={settings.default_video_config.height}
              onChange={e => update({ default_video_config: { ...settings.default_video_config, height: Number(e.target.value) } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Frame Rate (fps)</label>
            <select
              value={settings.default_video_config.fps}
              onChange={e => update({ default_video_config: { ...settings.default_video_config, fps: Number(e.target.value) } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[24, 25, 30, 60].map(f => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Codec</label>
            <select
              value={settings.default_video_config.codec}
              onChange={e => update({ default_video_config: { ...settings.default_video_config, codec: e.target.value as 'h264' | 'vp9' | 'av1' } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="h264">H.264 (recommended)</option>
              <option value="vp9">VP9</option>
              <option value="av1">AV1</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Encoding Quality" icon={<Gauge size={14} />}>
        <p className="text-xs text-slate-500 -mt-1 mb-3">Quick presets set the bitrate target. You can also enter a custom value.</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {QUALITY_PRESETS.map(preset => {
            const isActive = settings.default_video_config.bitrate_kbps === preset.bitrate;
            return (
              <button
                key={preset.label}
                onClick={() => update({ default_video_config: { ...settings.default_video_config, bitrate_kbps: preset.bitrate } })}
                className={`flex flex-col items-center p-2.5 rounded-xl border-2 text-center transition-colors ${isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className={`text-xs font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{preset.label}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{(preset.bitrate / 1000).toFixed(1)} Mbps</span>
              </button>
            );
          })}
        </div>
        <FieldRow label="Custom bitrate (kbps)" hint="Leave blank for encoder default">
          <input
            type="number"
            min={500}
            max={50000}
            step={500}
            value={settings.default_video_config.bitrate_kbps ?? ''}
            onChange={e => update({ default_video_config: { ...settings.default_video_config, bitrate_kbps: e.target.value ? Number(e.target.value) : undefined } })}
            placeholder="Auto"
            className="w-28 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FieldRow>
      </Section>

      <Section title="Captions" icon={<Captions size={14} />}>
        <FieldRow label="Enable captions by default" hint="Include caption track in output">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.default_caption_config.enabled}
              onChange={e => update({ default_caption_config: { ...settings.default_caption_config, enabled: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </FieldRow>
        <FieldRow label="Burn captions into video" hint="Permanently embed captions in video frames (requires compatible engine)">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.default_caption_config.burn_in ?? false}
              onChange={e => update({ default_caption_config: { ...settings.default_caption_config, burn_in: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Default format</label>
            <select
              value={settings.default_caption_config.format}
              onChange={e => update({ default_caption_config: { ...settings.default_caption_config, format: e.target.value as 'srt' | 'vtt' | 'json' } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="srt">SRT</option>
              <option value="vtt">VTT</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Position</label>
            <select
              value={settings.default_caption_config.position}
              onChange={e => update({ default_caption_config: { ...settings.default_caption_config, position: e.target.value as 'bottom' | 'top' } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Callouts" icon={<Megaphone size={14} />}>
        <FieldRow label="Enable callouts by default">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.default_callout_config.enabled}
              onChange={e => update({ default_callout_config: { ...settings.default_callout_config, enabled: e.target.checked } })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Style</label>
            <select
              value={settings.default_callout_config.style}
              onChange={e => update({ default_callout_config: { ...settings.default_callout_config, style: e.target.value as 'rounded' | 'pill' | 'box' } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
              <option value="box">Box</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Animation</label>
            <select
              value={settings.default_callout_config.animation}
              onChange={e => update({ default_callout_config: { ...settings.default_callout_config, animation: e.target.value as 'fade' | 'slide' | 'pop' | 'none' } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="pop">Pop</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
        <FieldRow label="Default display duration" hint="How long each callout stays visible">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={500}
              max={10000}
              step={250}
              value={settings.default_callout_config.default_duration_ms ?? 3000}
              onChange={e => update({ default_callout_config: { ...settings.default_callout_config, default_duration_ms: Number(e.target.value) } })}
              className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-400">ms</span>
          </div>
        </FieldRow>
      </Section>

      <Section title="Transitions" icon={<ArrowRightLeft size={14} />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Transition type</label>
            <select
              value={settings.default_transition_config.type}
              onChange={e => update({ default_transition_config: { ...settings.default_transition_config, type: e.target.value as 'cut' | 'crossfade' | 'fade' | 'slide' } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cut">Cut (instant)</option>
              <option value="crossfade">Crossfade</option>
              <option value="fade">Fade to black</option>
              <option value="slide">Slide</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Duration (ms)</label>
            <input
              type="number"
              min={0}
              max={2000}
              step={50}
              value={settings.default_transition_config.duration_ms}
              onChange={e => update({ default_transition_config: { ...settings.default_transition_config, duration_ms: Number(e.target.value) } })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Section>

      <Section title="Pipeline Behavior" icon={<Film size={14} />}>
        <FieldRow label="Auto-build timeline on assembly complete" hint="Builds render manifest when assembly finishes">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.auto_build_timeline_on_assembly}
              onChange={e => update({ auto_build_timeline_on_assembly: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </FieldRow>
        <FieldRow label="Include screenshot overlays" hint="Overlay screenshots on video scenes">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.include_screenshot_overlays}
              onChange={e => update({ include_screenshot_overlays: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </FieldRow>
        <FieldRow label="Narration sync enabled" hint="Sync narration audio to scene timeline">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.narration_sync_enabled}
              onChange={e => update({ narration_sync_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </FieldRow>
      </Section>
    </div>
  );
}

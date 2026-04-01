import { Palette, Type, ExternalLink, MousePointerClick } from 'lucide-react';
import { ThemeOverrides } from './types';

interface ThemeEditorProps {
  theme: ThemeOverrides;
  onChange: (theme: ThemeOverrides) => void;
}

const COLOR_PRESETS = [
  { label: 'CareMetric Blue', value: '#1a6ffa' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Slate', value: '#475569' },
];

export function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  function update(key: keyof ThemeOverrides, value: string) {
    onChange({ ...theme, [key]: value });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Palette className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Theme</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Brand Color</label>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="color"
              value={theme.brandColor}
              onChange={(e) => update('brandColor', e.target.value)}
              className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
            />
            <input
              type="text"
              value={theme.brandColor}
              onChange={(e) => update('brandColor', e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => update('brandColor', preset.value)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  theme.brandColor === preset.value
                    ? 'border-slate-800 scale-110'
                    : 'border-transparent hover:border-slate-300'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.label}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <Type className="w-3 h-3" />
            Brand Name
          </label>
          <input
            type="text"
            value={theme.brandName}
            onChange={(e) => update('brandName', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Tagline</label>
          <input
            type="text"
            value={theme.tagline}
            onChange={(e) => update('tagline', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <MousePointerClick className="w-3 h-3" />
            CTA Text
          </label>
          <input
            type="text"
            value={theme.ctaText}
            onChange={(e) => update('ctaText', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            Website URL
          </label>
          <input
            type="text"
            value={theme.ctaUrl}
            onChange={(e) => update('ctaUrl', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

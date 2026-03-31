import { Clock, HardDrive, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
import { ADAPTIVE_PRESETS, type AdaptivePreset } from '../../lib/renderPresets';
import type { RenderMode } from '../../types/documentation';

interface Props {
  selected: RenderMode;
  onChange: (preset: AdaptivePreset) => void;
}

const ACCENT: Record<AdaptivePreset['accentColor'], {
  card: string;
  cardSelected: string;
  badge: string;
  dot: string;
  feature: string;
  limitation: string;
  ring: string;
}> = {
  amber: {
    card: 'border-amber-100 hover:border-amber-300',
    cardSelected: 'border-amber-500 bg-amber-50/60',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
    feature: 'text-amber-700',
    limitation: 'text-amber-500',
    ring: 'ring-amber-400',
  },
  teal: {
    card: 'border-blue-100 hover:border-blue-300',
    cardSelected: 'border-blue-500 bg-blue-50/60',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
    feature: 'text-blue-700',
    limitation: 'text-blue-400',
    ring: 'ring-blue-400',
  },
  blue: {
    card: 'border-blue-100 hover:border-blue-300',
    cardSelected: 'border-blue-500 bg-blue-50/60',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
    feature: 'text-blue-700',
    limitation: 'text-blue-400',
    ring: 'ring-blue-400',
  },
};

export default function AdaptivePresetSelector({ selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ADAPTIVE_PRESETS.map((preset) => {
        const isSelected = selected === preset.mode;
        const a = ACCENT[preset.accentColor];

        return (
          <button
            key={preset.mode}
            onClick={() => onChange(preset)}
            className={`relative flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all focus:outline-none ${
              isSelected
                ? `${a.cardSelected} ring-2 ${a.ring} ring-offset-1`
                : `${a.card} bg-white`
            }`}
          >
            {isSelected && (
              <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${a.dot}`} />
            )}

            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-2.5 ${a.badge}`}>
              {preset.tagline}
            </span>

            <p className="text-sm font-semibold text-slate-900 leading-tight mb-1">
              {preset.label}
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              {preset.description}
            </p>

            <div className="flex flex-col gap-1 mb-3 w-full">
              {preset.features.map((f) => (
                <div key={f} className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className={`flex-shrink-0 mt-0.5 ${a.feature}`} />
                  <span className="text-[11px] text-slate-600">{f}</span>
                </div>
              ))}
              {preset.limitations.map((l) => (
                <div key={l} className="flex items-start gap-1.5">
                  <XCircle size={11} className={`flex-shrink-0 mt-0.5 ${a.limitation}`} />
                  <span className="text-[11px] text-slate-400">{l}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto flex flex-wrap gap-2 w-full pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock size={10} />
                {preset.estimatedTime}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <HardDrive size={10} />
                {preset.outputSizeRange}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

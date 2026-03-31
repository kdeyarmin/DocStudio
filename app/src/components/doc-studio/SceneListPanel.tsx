import { ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import type { SceneRow } from './result-types';

function formatSeconds(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function SceneListExpandable({
  scenes,
  scenesExpanded,
  onToggleScene,
}: {
  scenes: SceneRow[];
  scenesExpanded: Record<string, boolean>;
  onToggleScene: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Scenes</div>
      <div className="divide-y divide-slate-100">
        {scenes.length === 0 && <div className="p-4 text-sm text-slate-500">No scenes available.</div>}
        {scenes.map((scene, index) => {
          const expanded = scenesExpanded[scene.id] ?? false;
          return (
            <div key={scene.id} className="p-4">
              <button
                type="button"
                onClick={() => onToggleScene(scene.id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{scene.title || `Scene ${index + 1}`}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatSeconds(scene.start_time_seconds)} → {formatSeconds(scene.end_time_seconds)}
                  </div>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {expanded && (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {scene.summary && <p>{scene.summary}</p>}
                  {scene.narration_text && (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Narration</div>
                      <p className="whitespace-pre-wrap">{scene.narration_text}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SceneListCompact({ scenes }: { scenes: SceneRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Scene outline</div>
      <div className="divide-y divide-slate-100">
        {scenes.length === 0 && <div className="p-4 text-sm text-slate-500">No scenes available.</div>}
        {scenes.map((scene, index) => (
          <div key={scene.id} className="p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">{index + 1}. {scene.title || `Scene ${index + 1}`}</div>
            {scene.summary && <p className="mt-1 text-slate-600">{scene.summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

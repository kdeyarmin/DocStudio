import { Film, ListVideo } from 'lucide-react';
import type { NarrationAsset, RenderManifest } from './result-types';

interface VideoPreviewCardProps {
  renderManifest: RenderManifest;
  narrationAsset: NarrationAsset | null;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function VideoPreviewCard({ renderManifest, narrationAsset }: VideoPreviewCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Film className="h-4 w-4 text-slate-400" />
          Video preview summary
        </span>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scenes</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{renderManifest.scene_count}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatMs(renderManifest.total_duration_ms)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Narration</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {narrationAsset ? 'Attached audio available' : 'No audio asset linked'}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ListVideo className="h-4 w-4 text-slate-400" />
          Timeline scenes
        </div>
        <div className="space-y-2">
          {renderManifest.scenes.slice(0, 5).map((scene, index) => (
            <div key={`${scene.scene_id}-${index}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <div className="font-medium text-slate-900">{scene.title || `Scene ${index + 1}`}</div>
              <div className="text-xs text-slate-500">
                {formatMs(scene.start_ms)} → {formatMs(scene.end_ms)}
              </div>
            </div>
          ))}
          {renderManifest.scenes.length > 5 && (
            <div className="text-xs text-slate-500">+{renderManifest.scenes.length - 5} more scenes in the render manifest.</div>
          )}
        </div>
      </div>
    </div>
  );
}

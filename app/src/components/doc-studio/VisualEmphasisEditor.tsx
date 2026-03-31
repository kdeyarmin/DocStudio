import { useState } from 'react';
import { ZoomIn, Highlighter, Megaphone, X, Check, Info } from 'lucide-react';
import { useUpdateScene } from '../../hooks/useDocStudioScenes';
import { useToast } from '../../lib/toast';
import type { DocumentationScene, VisualEmphasisMetadata } from '../../types/documentation';

interface RegionInputProps {
  label: string;
  value: { x: number; y: number; width: number; height: number } | null;
  onChange: (v: { x: number; y: number; width: number; height: number } | null) => void;
  hint?: string;
}

function RegionInput({ label, value, onChange, hint }: RegionInputProps) {
  const [enabled, setEnabled] = useState(!!value);
  const region = value ?? { x: 0, y: 0, width: 100, height: 100 };

  const handleToggle = (on: boolean) => {
    setEnabled(on);
    onChange(on ? region : null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={e => handleToggle(e.target.checked)} className="sr-only peer" />
          <div className="w-8 h-4 bg-slate-200 rounded-full peer-checked:bg-blue-600 transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
        </label>
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      {enabled && (
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as const).map((field) => (
            <div key={field}>
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 uppercase">{field}</label>
              <input
                type="number"
                min={0}
                max={field === 'x' || field === 'width' ? 3840 : 2160}
                value={region[field]}
                onChange={e => onChange({ ...region, [field]: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  scene: DocumentationScene;
  draftId: string;
  onClose: () => void;
}

export function VisualEmphasisEditor({ scene, draftId, onClose }: Props) {
  const { showToast } = useToast();
  const updateScene = useUpdateScene();

  const existing = (scene.visual_emphasis_json ?? {}) as VisualEmphasisMetadata;

  const [calloutTitle, setCalloutTitle] = useState<string>(existing.callout_title ?? '');
  const [calloutDesc, setCalloutDesc] = useState<string>(existing.callout_description ?? '');
  const [zoomRegion, setZoomRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(
    existing.zoom_region ?? null
  );
  const [highlightRegion, setHighlightRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(
    existing.highlight_region ?? null
  );

  const handleSave = async () => {
    const emphasis: VisualEmphasisMetadata = {
      callout_title: calloutTitle.trim() || undefined,
      callout_description: calloutDesc.trim() || undefined,
      zoom_region: zoomRegion,
      highlight_region: highlightRegion,
    };
    try {
      await updateScene.mutateAsync({
        scene_id: scene.id,
        draft_id: draftId,
        visual_emphasis_json: emphasis as Record<string, unknown>,
      });
      showToast('Visual emphasis saved', 'success');
      onClose();
    } catch {
      showToast('Failed to save visual emphasis', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Visual Emphasis</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{scene.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Coordinates are in screen pixels relative to the captured screenshot. Regions control what area of the frame to emphasize during rendering.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone size={13} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Callout Overlay</span>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Title</label>
              <input
                value={calloutTitle}
                onChange={e => setCalloutTitle(e.target.value)}
                placeholder="e.g. Click here to continue"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Description (optional)</label>
              <input
                value={calloutDesc}
                onChange={e => setCalloutDesc(e.target.value)}
                placeholder="Additional context shown under the title"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <ZoomIn size={13} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Zoom Region</span>
            </div>
            <RegionInput
              label="Zoom into area"
              value={zoomRegion}
              onChange={setZoomRegion}
              hint="Pan & zoom the camera into this screen region during the scene"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Highlighter size={13} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Highlight Region</span>
            </div>
            <RegionInput
              label="Highlight area"
              value={highlightRegion}
              onChange={setHighlightRegion}
              hint="Draw an attention box around this screen region"
            />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateScene.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {updateScene.isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Save Emphasis
          </button>
        </div>
      </div>
    </div>
  );
}

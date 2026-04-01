import { useState } from 'react';
import { GripVertical, Eye, EyeOff, Clock, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { SceneConfig, SCENE_REGISTRY } from './types';

interface SceneTimelineProps {
  scenes: SceneConfig[];
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
  onToggleScene: (id: string) => void;
  onUpdateDuration: (id: string, seconds: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemoveScene: (id: string) => void;
}

export function SceneTimeline({
  scenes,
  selectedSceneId,
  onSelectScene,
  onToggleScene,
  onUpdateDuration,
  onReorder,
  onRemoveScene,
}: SceneTimelineProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const totalSeconds = scenes.filter((s) => s.enabled).reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalSecs = totalSeconds % 60;

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDropIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
    }
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropIndex(null);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Timeline</span>
        </div>
        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {totalMinutes}:{totalSecs.toString().padStart(2, '0')} total
        </span>
      </div>

      <div className="divide-y divide-slate-50">
        {scenes.map((scene, index) => {
          const meta = SCENE_REGISTRY[scene.type];
          const isSelected = scene.id === selectedSceneId;
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index;

          let _cumulative = 0;
          for (let i = 0; i < index; i++) {
            if (scenes[i].enabled) _cumulative += scenes[i].durationSeconds;
          }

          return (
            <div
              key={scene.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectScene(scene.id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all
                ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'border-l-2 border-l-transparent hover:bg-slate-50'}
                ${isDragging ? 'opacity-40' : ''}
                ${isDropTarget && !isDragging ? 'border-t-2 border-t-blue-400' : ''}
                ${!scene.enabled ? 'opacity-50' : ''}
              `}
            >
              <div className="cursor-grab text-slate-300 hover:text-slate-500">
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{scene.label}</div>
                <div className="text-[10px] text-slate-400">{meta?.description}</div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateDuration(scene.id, Math.max(2, scene.durationSeconds - 2));
                  }}
                  className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono text-slate-600 w-8 text-center">{scene.durationSeconds}s</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateDuration(scene.id, scene.durationSeconds + 2);
                  }}
                  className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleScene(scene.id);
                }}
                className="p-1 rounded hover:bg-slate-200"
              >
                {scene.enabled ? (
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveScene(scene.id);
                }}
                className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
        <div className="flex gap-1 h-3">
          {scenes.filter((s) => s.enabled).map((scene) => {
            const pct = totalSeconds > 0 ? (scene.durationSeconds / totalSeconds) * 100 : 0;
            const isSelected = scene.id === selectedSceneId;
            return (
              <div
                key={scene.id}
                onClick={() => onSelectScene(scene.id)}
                className={`rounded-sm cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                style={{
                  width: `${pct}%`,
                  backgroundColor: isSelected ? '#2563eb' : '#cbd5e1',
                }}
                title={`${scene.label} (${scene.durationSeconds}s)`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

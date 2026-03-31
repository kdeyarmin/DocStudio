import { useState, useEffect } from 'react';
import { Plus, Loader as Loader2, Layers, Clock, RefreshCw, Trash2, GripVertical, ChevronDown, ChevronRight, Image, Mic, ZoomIn } from 'lucide-react';
import {
  useDocStudioScenes,
  useCreateScene,
  useDeleteScene,
  useUpdateScene,
  useReorderScenes,
} from '../../../hooks/useDocStudioScenes';
import { useToast } from '../../../lib/toast';
import { VisualEmphasisEditor } from '../VisualEmphasisEditor';
import type { DocumentationScene } from '../../../types/documentation';

const QUALITY_COLORS: Record<string, string> = {
  good: 'bg-green-100 text-green-700',
  needs_review: 'bg-amber-100 text-amber-700',
  poor: 'bg-red-100 text-red-700',
  pending: 'bg-slate-100 text-slate-500',
};

const QUALITY_DOT: Record<string, string> = {
  good: 'bg-green-500',
  needs_review: 'bg-amber-500',
  poor: 'bg-red-500',
  pending: 'bg-slate-300',
};

const PALETTE = [
  'bg-blue-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-emerald-500', 'bg-sky-500', 'bg-orange-500',
];

function fmt(s?: number | null) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

interface TimelineBarProps {
  scenes: DocumentationScene[];
  activeSceneId: string | null;
  onSceneClick: (id: string) => void;
}

function TimelineBar({ scenes, activeSceneId, onSceneClick }: TimelineBarProps) {
  const timed = scenes.filter(
    (s) => s.start_time_seconds != null && s.end_time_seconds != null,
  );
  if (timed.length === 0) return null;

  const totalDuration = timed.reduce(
    (sum, s) => sum + ((s.end_time_seconds ?? 0) - (s.start_time_seconds ?? 0)),
    0,
  );

  return (
    <div className="w-full h-8 flex rounded-lg overflow-hidden ring-1 ring-slate-200 mb-4">
      {timed.map((scene, i) => {
        const dur = (scene.end_time_seconds ?? 0) - (scene.start_time_seconds ?? 0);
        const pct = totalDuration > 0 ? (dur / totalDuration) * 100 : 0;
        const color = PALETTE[i % PALETTE.length];
        const isActive = scene.id === activeSceneId;
        return (
          <button
            key={scene.id}
            title={`${scene.title} (${fmt(dur)})`}
            style={{ width: `${pct}%` }}
            onClick={() => onSceneClick(scene.id)}
            className={`relative group h-full transition-opacity ${color} ${isActive ? 'opacity-100 ring-2 ring-inset ring-white/60' : 'opacity-70 hover:opacity-90'}`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
              {scene.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface SceneCardProps {
  scene: DocumentationScene;
  draftId: string;
  index: number;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onDelete: () => void;
  onOpenEmphasis: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function SceneCard({
  scene, draftId, index, isActive, isDragging, isDragOver,
  onClick, onDelete, onOpenEmphasis, onDragStart, onDragOver, onDrop, onDragEnd,
}: SceneCardProps) {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(scene.title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(scene.notes ?? '');
  const update = useUpdateScene();
  const { showToast } = useToast();

  const handleTitleSave = async () => {
    if (!titleVal.trim()) { setEditingTitle(false); return; }
    setEditingTitle(false);
    try {
      await update.mutateAsync({ scene_id: scene.id, draft_id: draftId, title: titleVal.trim() });
    } catch {
      showToast('Failed to update title', 'error');
    }
  };

  const handleNotesSave = async () => {
    setEditingNotes(false);
    try {
      await update.mutateAsync({ scene_id: scene.id, draft_id: draftId, notes: notesVal });
    } catch {
      showToast('Failed to update notes', 'error');
    }
  };

  const duration =
    scene.start_time_seconds != null && scene.end_time_seconds != null
      ? scene.end_time_seconds - scene.start_time_seconds
      : null;

  const color = PALETTE[index % PALETTE.length];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-white border rounded-xl overflow-hidden transition-all ${
        isDragOver ? 'border-blue-400 shadow-md ring-1 ring-blue-300' : 'border-slate-200'
      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''} ${
        isActive ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 flex-shrink-0">
          <GripVertical size={14} />
        </div>

        <div className={`flex items-center justify-center w-6 h-6 rounded-md ${color} text-white font-bold text-[11px] flex-shrink-0`}>
          {scene.scene_order ?? index + 1}
        </div>

        <div className="flex-1 min-w-0" onClick={onClick}>
          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-slate-800 bg-transparent border-b border-blue-500 outline-none w-full"
            />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
              className="text-sm font-medium text-slate-800 hover:text-blue-700 text-left truncate w-full block"
            >
              {scene.title}
            </button>
          )}
          <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-slate-400">
            {duration != null && (
              <span className="flex items-center gap-1"><Clock size={9} />{fmt(duration)}</span>
            )}
            {scene.scene_steps && scene.scene_steps.length > 0 && (
              <span>{scene.scene_steps.length} step{scene.scene_steps.length !== 1 ? 's' : ''}</span>
            )}
            {scene.narration_count != null && scene.narration_count > 0 && (
              <span className="flex items-center gap-1"><Mic size={9} />{scene.narration_count}</span>
            )}
            {scene.asset_count != null && scene.asset_count > 0 && (
              <span className="flex items-center gap-1"><Image size={9} />{scene.asset_count}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {scene.quality_status && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${QUALITY_DOT[scene.quality_status] ?? QUALITY_DOT.pending}`} title={scene.quality_status.replace('_', ' ')} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onOpenEmphasis(); }}
            className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Visual emphasis"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
          {scene.summary && (
            <p className="text-xs text-slate-500 leading-relaxed">{scene.summary}</p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            {scene.start_time_seconds != null && (
              <span>Start: {fmt(scene.start_time_seconds)}</span>
            )}
            {scene.end_time_seconds != null && (
              <span>End: {fmt(scene.end_time_seconds)}</span>
            )}
          </div>

          {scene.scene_steps && scene.scene_steps.length > 0 && (
            <div className="space-y-1">
              {scene.scene_steps.map((ss) => (
                <div key={ss.id} className="flex items-center gap-2 text-xs text-slate-500 py-0.5">
                  <span className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400 flex-shrink-0 font-mono text-[10px]">
                    {ss.step_order}
                  </span>
                  <span className="truncate">{ss.workflow_step_id ?? 'Manual step'}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</div>
            {editingNotes ? (
              <textarea
                autoFocus
                value={notesVal}
                onChange={(e) => setNotesVal(e.target.value)}
                onBlur={handleNotesSave}
                rows={2}
                className="w-full text-xs text-slate-600 bg-white border border-blue-400 rounded px-2 py-1.5 outline-none resize-none"
              />
            ) : (
              <button
                onClick={() => setEditingNotes(true)}
                className="w-full text-left text-xs text-slate-400 hover:text-slate-600 bg-white border border-slate-100 rounded px-2 py-1.5 transition-colors"
              >
                {scene.notes ? scene.notes : 'Add notes…'}
              </button>
            )}
          </div>

          {scene.quality_status && (
            <span className={`inline-flex text-xs px-2 py-0.5 rounded-full capitalize ${QUALITY_COLORS[scene.quality_status] ?? QUALITY_COLORS.pending}`}>
              {scene.quality_status.replace('_', ' ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  draftId: string;
}

export function ScenesTab({ draftId }: Props) {
  const { showToast } = useToast();
  const { data: scenes = [], isLoading, refetch } = useDocStudioScenes(draftId);
  const createScene = useCreateScene();
  const deleteScene = useDeleteScene();
  const reorderScenes = useReorderScenes();

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [emphasisScene, setEmphasisScene] = useState<DocumentationScene | null>(null);

  useEffect(() => {
    setOrderedIds(scenes.map((s) => s.id));
  }, [scenes]);

  const orderedScenes = orderedIds
    .map((id) => scenes.find((s) => s.id === id))
    .filter(Boolean) as DocumentationScene[];

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => { setDraggingId(null); setDragOverId(null); };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== draggingId) setDragOverId(targetId);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { handleDragEnd(); return; }

    const next = [...orderedIds];
    const fromIdx = next.indexOf(draggingId);
    const toIdx = next.indexOf(targetId);
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    setOrderedIds(next);
    handleDragEnd();

    try {
      await reorderScenes.mutateAsync({ draft_id: draftId, ordered_ids: next });
    } catch {
      showToast('Failed to reorder scenes', 'error');
      setOrderedIds(scenes.map((s) => s.id));
    }
  };

  const handleAddScene = async () => {
    try {
      await createScene.mutateAsync({
        draft_id: draftId,
        title: `Scene ${scenes.length + 1}`,
        scene_order: scenes.length + 1,
      });
    } catch {
      showToast('Failed to create scene', 'error');
    }
  };

  const handleDelete = async (sceneId: string) => {
    if (deleting) return;
    setDeleting(sceneId);
    try {
      await deleteScene.mutateAsync({ scene_id: sceneId, draft_id: draftId });
    } catch {
      showToast('Failed to delete scene', 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Layers size={15} />
          <span>{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={handleAddScene}
            disabled={createScene.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createScene.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Scene
          </button>
        </div>
      </div>

      {orderedScenes.length > 0 && (
        <TimelineBar
          scenes={orderedScenes}
          activeSceneId={activeSceneId}
          onSceneClick={(id) => setActiveSceneId((prev) => (prev === id ? null : id))}
        />
      )}

      {orderedScenes.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          No scenes yet. Add one or run a Playwright job to auto-generate scenes.
        </div>
      ) : (
        <div className="space-y-2">
          {orderedScenes.map((scene, i) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              draftId={draftId}
              index={i}
              isActive={activeSceneId === scene.id}
              isDragging={draggingId === scene.id}
              isDragOver={dragOverId === scene.id}
              onClick={() => setActiveSceneId((prev) => (prev === scene.id ? null : scene.id))}
              onDelete={() => handleDelete(scene.id)}
              onOpenEmphasis={() => setEmphasisScene(scene)}
              onDragStart={() => handleDragStart(scene.id)}
              onDragOver={(e) => handleDragOver(e, scene.id)}
              onDrop={(e) => handleDrop(e, scene.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {reorderScenes.isPending && (
        <div className="flex items-center gap-2 text-xs text-blue-600 justify-center py-1">
          <Loader2 size={12} className="animate-spin" />
          Saving order…
        </div>
      )}

      {emphasisScene && (
        <VisualEmphasisEditor
          scene={emphasisScene}
          draftId={draftId}
          onClose={() => setEmphasisScene(null)}
        />
      )}
    </div>
  );
}

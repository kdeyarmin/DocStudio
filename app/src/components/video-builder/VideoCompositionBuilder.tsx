import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film,
  Plus,
  Save,
  Trash2,
  Copy,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  LayoutDashboard,
  Wand2,
  Mic,
  Grid3x3,
  Megaphone,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import {
  VideoComposition,
  SceneConfig,
  ThemeOverrides,
  SCENE_REGISTRY,
  SceneType,
  createDefaultScenes,
  DEFAULT_THEME,
} from './types';
import { SceneTimeline } from './SceneTimeline';
import { SceneEditor } from './SceneEditor';
import { ThemeEditor } from './ThemeEditor';
import { PreviewPanel } from './PreviewPanel';

export function VideoCompositionBuilder() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [compositions, setCompositions] = useState<VideoComposition[]>([]);
  const [activeComposition, setActiveComposition] = useState<VideoComposition | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddScene, setShowAddScene] = useState(false);
  const [rightPanel, setRightPanel] = useState<'scene' | 'theme'>('scene');

  const loadGeneration = useRef(0);
  const fetchCompositions = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const { data, error } = await supabase
        .from('video_compositions')
        .select('*')
        .order('updated_at', { ascending: false });
      if (generation !== loadGeneration.current) return;
      if (error) showToast('Failed to load compositions', 'error');
      else setCompositions((data as VideoComposition[]) || []);
    } catch {
      if (generation === loadGeneration.current) showToast('Failed to load compositions', 'error');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [showToast]);

  function loadCompositions() {
    setLoading(true);
    void fetchCompositions();
  }

  useEffect(() => {
    void fetchCompositions();
    return () => { loadGeneration.current++; };
  }, [fetchCompositions]);

  async function createComposition() {
    if (!user) return;
    const { data, error } = await supabase
      .from('video_compositions')
      .insert({
        name: 'Untitled Video',
        description: '',
        status: 'draft',
        duration_seconds: 120,
        fps: 30,
        width: 1920,
        height: 1080,
        scenes: createDefaultScenes(),
        theme: DEFAULT_THEME,
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (error) {
      showToast('Failed to create composition', 'error');
      return;
    }
    if (data) {
      setCompositions((prev) => [data as VideoComposition, ...prev]);
      setActiveComposition(data as VideoComposition);
      setSelectedSceneId((data as VideoComposition).scenes[0]?.id || null);
      showToast('Composition created', 'success');
    }
  }

  async function saveComposition() {
    if (!activeComposition) return;
    setSaving(true);

    const totalDuration = activeComposition.scenes
      .filter((s) => s.enabled)
      .reduce((sum, s) => sum + s.durationSeconds, 0);

    const { error } = await supabase
      .from('video_compositions')
      .update({
        name: activeComposition.name,
        description: activeComposition.description,
        status: activeComposition.status,
        duration_seconds: totalDuration,
        scenes: activeComposition.scenes,
        theme: activeComposition.theme,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeComposition.id);

    setSaving(false);
    if (error) {
      showToast('Failed to save', 'error');
    } else {
      showToast('Saved', 'success');
      loadCompositions();
    }
  }

  async function duplicateComposition(comp: VideoComposition) {
    if (!user) return;
    const { data } = await supabase
      .from('video_compositions')
      .insert({
        name: `${comp.name} (copy)`,
        description: comp.description,
        status: 'draft',
        duration_seconds: comp.duration_seconds,
        fps: comp.fps,
        width: comp.width,
        height: comp.height,
        scenes: comp.scenes,
        theme: comp.theme,
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (data) {
      setCompositions((prev) => [data as VideoComposition, ...prev]);
      showToast('Duplicated', 'success');
    }
  }

  async function deleteComposition(id: string) {
    const { error } = await supabase.from('video_compositions').delete().eq('id', id);
    if (!error) {
      setCompositions((prev) => prev.filter((c) => c.id !== id));
      if (activeComposition?.id === id) setActiveComposition(null);
      showToast('Deleted', 'success');
    }
  }

  async function updateStatus(status: 'draft' | 'published' | 'archived') {
    if (!activeComposition) return;
    setActiveComposition({ ...activeComposition, status });
  }

  function updateScene(sceneId: string, updated: Partial<SceneConfig>) {
    if (!activeComposition) return;
    setActiveComposition({
      ...activeComposition,
      scenes: activeComposition.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...updated } : s,
      ),
    });
  }

  function toggleScene(sceneId: string) {
    if (!activeComposition) return;
    setActiveComposition({
      ...activeComposition,
      scenes: activeComposition.scenes.map((s) =>
        s.id === sceneId ? { ...s, enabled: !s.enabled } : s,
      ),
    });
  }

  function removeScene(sceneId: string) {
    if (!activeComposition) return;
    setActiveComposition({
      ...activeComposition,
      scenes: activeComposition.scenes.filter((s) => s.id !== sceneId),
    });
    if (selectedSceneId === sceneId) setSelectedSceneId(null);
  }

  function reorderScenes(fromIndex: number, toIndex: number) {
    if (!activeComposition) return;
    const newScenes = [...activeComposition.scenes];
    const [moved] = newScenes.splice(fromIndex, 1);
    newScenes.splice(toIndex, 0, moved);
    setActiveComposition({ ...activeComposition, scenes: newScenes });
  }

  function addScene(type: SceneType) {
    if (!activeComposition) return;
    const meta = SCENE_REGISTRY[type];
    const newScene: SceneConfig = {
      id: `scene-${Date.now()}`,
      type,
      label: meta.label,
      durationSeconds: meta.defaultDuration,
      enabled: true,
      props: {},
    };
    setActiveComposition({
      ...activeComposition,
      scenes: [...activeComposition.scenes, newScene],
    });
    setSelectedSceneId(newScene.id);
    setShowAddScene(false);
  }

  const selectedScene = activeComposition?.scenes.find((s) => s.id === selectedSceneId) || null;

  if (!activeComposition) {
    return (
      <CompositionList
        compositions={compositions}
        loading={loading}
        onSelect={(comp) => {
          setActiveComposition(comp);
          setSelectedSceneId(comp.scenes[0]?.id || null);
        }}
        onCreate={createComposition}
        onDuplicate={duplicateComposition}
        onDelete={deleteComposition}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveComposition(null);
              setSelectedSceneId(null);
              loadCompositions();
            }}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={activeComposition.name}
              onChange={(e) => setActiveComposition({ ...activeComposition, name: e.target.value })}
              className="text-xl font-bold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
            />
            <input
              type="text"
              value={activeComposition.description}
              onChange={(e) => setActiveComposition({ ...activeComposition, description: e.target.value })}
              placeholder="Add a description..."
              className="block text-sm text-slate-400 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-80 placeholder:text-slate-300"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={activeComposition.status}
            onChangeStatus={updateStatus}
          />
          <button
            onClick={saveComposition}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 space-y-4">
          <SceneTimeline
            scenes={activeComposition.scenes}
            selectedSceneId={selectedSceneId}
            onSelectScene={setSelectedSceneId}
            onToggleScene={toggleScene}
            onUpdateDuration={(id, sec) => updateScene(id, { durationSeconds: sec })}
            onReorder={reorderScenes}
            onRemoveScene={removeScene}
          />
          <button
            onClick={() => setShowAddScene(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Scene
          </button>
        </div>

        <div className="col-span-6">
          <PreviewPanel
            scenes={activeComposition.scenes}
            selectedSceneId={selectedSceneId}
          />
        </div>

        <div className="col-span-3 space-y-4">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setRightPanel('scene')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                rightPanel === 'scene' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Scene
            </button>
            <button
              onClick={() => setRightPanel('theme')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                rightPanel === 'theme' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Theme
            </button>
          </div>

          {rightPanel === 'scene' && selectedScene ? (
            <SceneEditor
              scene={selectedScene}
              onChange={(updated) => {
                if (!activeComposition) return;
                setActiveComposition({
                  ...activeComposition,
                  scenes: activeComposition.scenes.map((s) =>
                    s.id === updated.id ? updated : s,
                  ),
                });
              }}
            />
          ) : rightPanel === 'scene' ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Select a scene to edit</p>
            </div>
          ) : (
            <ThemeEditor
              theme={activeComposition.theme as ThemeOverrides}
              onChange={(theme) => setActiveComposition({ ...activeComposition, theme })}
            />
          )}
        </div>
      </div>

      {showAddScene && (
        <AddSceneModal
          onAdd={addScene}
          onClose={() => setShowAddScene(false)}
          existingTypes={activeComposition.scenes.map((s) => s.type)}
        />
      )}
    </div>
  );
}

function CompositionList({
  compositions,
  loading,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: {
  compositions: VideoComposition[];
  loading: boolean;
  onSelect: (comp: VideoComposition) => void;
  onCreate: () => void;
  onDuplicate: (comp: VideoComposition) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Video Compositions</h3>
          <p className="text-sm text-slate-500 mt-1">Create and manage product demo videos</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New Composition
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      ) : compositions.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Film className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-lg font-semibold text-slate-600 mb-1">No compositions yet</p>
          <p className="text-sm text-slate-400 mb-4">Create your first product demo video</p>
          <button
            onClick={onCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
          >
            Create First Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {compositions.map((comp) => {
            const sceneCount = comp.scenes.filter((s: SceneConfig) => s.enabled).length;
            const mins = Math.floor(comp.duration_seconds / 60);
            const secs = comp.duration_seconds % 60;
            return (
              <div
                key={comp.id}
                onClick={() => onSelect(comp)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group overflow-hidden"
              >
                <div className="h-32 bg-gradient-to-br from-slate-800 to-slate-900 relative flex items-center justify-center">
                  <Film className="w-10 h-10 text-slate-600" />
                  <div className="absolute top-3 right-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        comp.status === 'published'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : comp.status === 'archived'
                          ? 'bg-slate-500/20 text-slate-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-500">
                    {comp.width}x{comp.height}
                  </div>
                  <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-500">
                    {mins}:{secs.toString().padStart(2, '0')}
                  </div>
                </div>

                <div className="p-4">
                  <div className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                    {comp.name}
                  </div>
                  {comp.description && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{comp.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-slate-400">
                      {sceneCount} scenes
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(comp);
                        }}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(comp.id);
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  onChangeStatus,
}: {
  status: string;
  onChangeStatus: (status: 'draft' | 'published' | 'archived') => void;
}) {
  const [open, setOpen] = useState(false);

  const colors: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-700 border-amber-200',
    published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    archived: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize ${colors[status]}`}
      >
        {status}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 w-32">
            {(['draft', 'published', 'archived'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChangeStatus(s);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm capitalize hover:bg-slate-50 ${
                  s === status ? 'font-semibold text-blue-600' : 'text-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const SCENE_ICONS: Record<SceneType, typeof Film> = {
  'brand-intro': Sparkles,
  'problem-statement': AlertTriangle,
  'dashboard-overview': LayoutDashboard,
  'ai-generation': Wand2,
  'ambient-listening': Mic,
  'feature-montage': Grid3x3,
  'closing-cta': Megaphone,
};

function AddSceneModal({
  onAdd,
  onClose,
  existingTypes,
}: {
  onAdd: (type: SceneType) => void;
  onClose: () => void;
  existingTypes: SceneType[];
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Add Scene</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {(Object.entries(SCENE_REGISTRY) as [SceneType, typeof SCENE_REGISTRY[SceneType]][]).map(
            ([type, meta]) => {
              const Icon = SCENE_ICONS[type];
              const alreadyExists = existingTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => onAdd(type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      {meta.label}
                      {alreadyExists && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          already added
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{meta.description}</div>
                  </div>
                  <div className="text-xs font-mono text-slate-400">{meta.defaultDuration}s</div>
                </button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoCompositionBuilder;

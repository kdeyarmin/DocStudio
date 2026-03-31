import { useState } from 'react';
import { Film, RefreshCw, Trash2, Plus, Star, StarOff, ChevronDown, ChevronRight, Loader as Loader2, ZoomIn, Highlighter, MessageSquare, ArrowRight, Clock, Camera, Layers, CircleAlert as AlertCircle } from 'lucide-react';
import {
  useDocStudioShotPlans,
  useDocStudioShotPlanSummary,
  useGenerateShotPlans,
  useRegenerateShotPlansForScene,
  useDeleteAllShotPlans,
  useToggleKeyShotFlag,
  useDeleteShotPlan,
} from '../../../hooks/useDocStudioShotPlans';
import { useDocStudioScenes } from '../../../hooks/useDocStudioScenes';
import { useToast } from '../../../lib/toast';
import type { DocumentationShotPlan } from '../../../types/documentation';

const SHOT_TYPE_LABELS: Record<string, string> = {
  full_screen: 'Full Screen',
  focused_crop: 'Focused Crop',
  zoom_highlight: 'Zoom Highlight',
  intro_cover: 'Intro Cover',
  outro_summary: 'Outro Summary',
  confirmation_focus: 'Confirmation',
  error_focus: 'Error Focus',
  split_screen: 'Split Screen',
  overlay_callout: 'Overlay Callout',
  pan_sequence: 'Pan Sequence',
};

const SHOT_TYPE_COLORS: Record<string, string> = {
  full_screen: 'bg-slate-100 text-slate-600',
  focused_crop: 'bg-blue-100 text-blue-700',
  zoom_highlight: 'bg-blue-100 text-blue-700',
  intro_cover: 'bg-emerald-100 text-emerald-700',
  outro_summary: 'bg-emerald-100 text-emerald-700',
  confirmation_focus: 'bg-green-100 text-green-700',
  error_focus: 'bg-red-100 text-red-700',
  split_screen: 'bg-violet-100 text-violet-700',
  overlay_callout: 'bg-amber-100 text-amber-700',
  pan_sequence: 'bg-sky-100 text-sky-700',
};

const EMPHASIS_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  normal: 'text-slate-600',
  high: 'text-amber-500',
  critical: 'text-red-500',
};

const TRANSITION_LABELS: Record<string, string> = {
  cut: 'Cut',
  crossfade: 'Crossfade',
  fade_to_black: 'Fade Out',
  fade_from_black: 'Fade In',
  slide_left: 'Slide L',
  slide_right: 'Slide R',
  wipe: 'Wipe',
  zoom_in: 'Zoom In',
  zoom_out: 'Zoom Out',
  none: 'None',
};

function fmt(s?: number | null) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtDuration(start?: number | null, end?: number | null) {
  if (start == null || end == null) return '—';
  return fmt(end - start);
}

// ─── Shot Plan Card ───────────────────────────────────────────────────────────

interface ShotPlanCardProps {
  plan: DocumentationShotPlan;
  index: number;
  onToggleKey: () => void;
  onDelete: () => void;
}

function ShotPlanCard({ plan, index, onToggleKey, onDelete }: ShotPlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${plan.is_key_shot ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-mono text-slate-400 w-5 text-right shrink-0">{index + 1}</span>

        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${SHOT_TYPE_COLORS[plan.shot_type] ?? 'bg-slate-100 text-slate-600'}`}>
          {SHOT_TYPE_LABELS[plan.shot_type] ?? plan.shot_type}
        </span>

        <span className="flex-1 text-sm font-medium text-slate-800 truncate">{plan.title}</span>

        <div className="flex items-center gap-2 shrink-0">
          {plan.zoom_region_json && <span title="Has zoom region"><ZoomIn size={13} className="text-blue-500" /></span>}
          {plan.highlight_region_json && <span title="Has highlight region"><Highlighter size={13} className="text-amber-500" /></span>}
          {plan.callout_title && <span title="Has callout"><MessageSquare size={13} className="text-blue-500" /></span>}

          <span className="text-xs text-slate-400">{fmtDuration(plan.start_time_seconds, plan.end_time_seconds)}</span>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleKey(); }}
            className={`p-1 rounded hover:bg-slate-100 transition-colors ${plan.is_key_shot ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
            title={plan.is_key_shot ? 'Remove key shot' : 'Mark as key shot'}
          >
            {plan.is_key_shot ? <Star size={14} className="fill-current" /> : <StarOff size={14} />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
            title="Delete shot plan"
          >
            <Trash2 size={13} />
          </button>

          {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1">Purpose</p>
              <p className="text-slate-700 font-medium">{plan.purpose.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1">Emphasis</p>
              <p className={`font-medium ${EMPHASIS_COLORS[plan.emphasis_level]}`}>
                {plan.emphasis_level}
              </p>
            </div>
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1">Pacing</p>
              <p className="text-slate-700 font-medium">{plan.pacing_mode.replace(/_/g, ' ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1">Transition In</p>
              <div className="flex items-center gap-1 text-slate-700">
                <ArrowRight size={11} className="text-slate-400" />
                <span className="font-medium">{TRANSITION_LABELS[plan.transition_in] ?? plan.transition_in}</span>
                {plan.transition_duration > 0 && (
                  <span className="text-slate-400">({(plan.transition_duration * 1000).toFixed(0)}ms)</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1">Transition Out</p>
              <div className="flex items-center gap-1 text-slate-700">
                <span className="font-medium">{TRANSITION_LABELS[plan.transition_out] ?? plan.transition_out}</span>
                <ArrowRight size={11} className="text-slate-400" />
              </div>
            </div>
          </div>

          {(plan.zoom_region_json || plan.highlight_region_json) && (
            <div className="grid grid-cols-2 gap-3">
              {plan.zoom_region_json && (
                <div>
                  <p className="text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <ZoomIn size={10} /> Zoom Region
                  </p>
                  <p className="text-slate-600 font-mono">
                    {plan.zoom_region_json.x},{plan.zoom_region_json.y} — {plan.zoom_region_json.width}×{plan.zoom_region_json.height}
                  </p>
                </div>
              )}
              {plan.highlight_region_json && (
                <div>
                  <p className="text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Highlighter size={10} /> Highlight Region
                  </p>
                  <p className="text-slate-600 font-mono">
                    {plan.highlight_region_json.x},{plan.highlight_region_json.y} — {plan.highlight_region_json.width}×{plan.highlight_region_json.height}
                  </p>
                </div>
              )}
            </div>
          )}

          {plan.callout_title && (
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare size={10} /> Callout
              </p>
              <p className="text-slate-700 font-medium">{plan.callout_title}</p>
              {plan.callout_description && (
                <p className="text-slate-500 mt-0.5">{plan.callout_description}</p>
              )}
            </div>
          )}

          {plan.notes && (
            <div>
              <p className="text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-slate-600 italic">{plan.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shot Timeline View ───────────────────────────────────────────────────────

interface ShotTimelineViewProps {
  plans: DocumentationShotPlan[];
}

function ShotTimelineView({ plans }: ShotTimelineViewProps) {
  if (!plans.length) return null;

  const totalDuration = plans.reduce(
    (sum, p) => sum + ((p.end_time_seconds ?? 0) - (p.start_time_seconds ?? 0)),
    0,
  );

  if (totalDuration === 0) return null;

  return (
    <div className="w-full h-10 flex rounded-lg overflow-hidden ring-1 ring-slate-200">
      {plans.map((plan, i) => {
        const dur = (plan.end_time_seconds ?? 0) - (plan.start_time_seconds ?? 0);
        const pct = (dur / totalDuration) * 100;
        const colors: Record<string, string> = {
          intro_cover: 'bg-emerald-400',
          outro_summary: 'bg-emerald-500',
          zoom_highlight: 'bg-blue-400',
          confirmation_focus: 'bg-green-400',
          error_focus: 'bg-red-400',
          focused_crop: 'bg-blue-400',
          overlay_callout: 'bg-amber-400',
          full_screen: 'bg-slate-300',
          split_screen: 'bg-violet-400',
          pan_sequence: 'bg-sky-400',
        };
        const bg = colors[plan.shot_type] ?? 'bg-slate-300';

        return (
          <div
            key={plan.id}
            title={`${SHOT_TYPE_LABELS[plan.shot_type]} — ${plan.title} (${fmtDuration(plan.start_time_seconds, plan.end_time_seconds)})`}
            style={{ width: `${Math.max(pct, 0.5)}%` }}
            className={`relative group h-full ${bg} ${plan.is_key_shot ? 'ring-2 ring-inset ring-white/70' : ''} ${i < plans.length - 1 ? 'border-r border-white/30' : ''} hover:opacity-80 transition-opacity cursor-default`}
          >
            {plan.is_key_shot && (
              <Star size={8} className="absolute top-1 left-1 text-white fill-white opacity-90" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Scene Group ─────────────────────────────────────────────────────────────

interface SceneGroupProps {
  sceneId: string;
  sceneTitle: string;
  sceneIndex: number;
  plans: DocumentationShotPlan[];
  draftId: string;
  onToggleKey: (planId: string, isKeyShot: boolean) => void;
  onDeletePlan: (planId: string) => void;
  onRegenerateScene: (sceneId: string) => void;
  isRegenerating: boolean;
}

function SceneGroup({
  sceneId, sceneTitle, sceneIndex, plans,
  onToggleKey, onDeletePlan, onRegenerateScene, isRegenerating,
}: SceneGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="text-xs font-mono text-slate-400 w-5 text-right shrink-0">{sceneIndex + 1}</span>
        {collapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{sceneTitle}</span>
        <span className="text-xs text-slate-400">{plans.length} shot{plans.length !== 1 ? 's' : ''}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRegenerateScene(sceneId); }}
          disabled={isRegenerating}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
          title="Regenerate shot plans for this scene"
        >
          {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Regen
        </button>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {plans.length > 1 && (
            <div className="mb-3">
              <ShotTimelineView plans={plans} />
            </div>
          )}
          {plans.map((plan, i) => (
            <ShotPlanCard
              key={plan.id}
              plan={plan}
              index={i}
              onToggleKey={() => onToggleKey(plan.id, !plan.is_key_shot)}
              onDelete={() => onDeletePlan(plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

interface ShotPlansTabProps {
  draftId: string;
}

export function ShotPlansTab({ draftId }: ShotPlansTabProps) {
  const toast = useToast();
  const [regeneratingScene, setRegeneratingScene] = useState<string | null>(null);
  const [view, setView] = useState<'grouped' | 'flat'>('grouped');

  const { data: shotPlans = [], isLoading: plansLoading } = useDocStudioShotPlans(draftId);
  const { data: scenes = [] } = useDocStudioScenes(draftId);
  const summary = useDocStudioShotPlanSummary(draftId);

  const generate = useGenerateShotPlans();
  const regenerateScene = useRegenerateShotPlansForScene();
  const deleteAll = useDeleteAllShotPlans();
  const toggleKey = useToggleKeyShotFlag();
  const deletePlan = useDeleteShotPlan();

  const hasPlans = shotPlans.length > 0;

  function handleGenerate(replaceExisting = false) {
    generate.mutate(
      { draft_id: draftId, replace_existing: replaceExisting },
      {
        onSuccess: (res) => {
          if (res?.warnings?.length) {
            toast.showToast(`Generated with ${res.warnings.length} warning(s)`, 'info');
          } else {
            toast.showToast(`Generated ${res?.created ?? 0} shot plans`, 'success');
          }
        },
        onError: (e) => toast.showToast(`Generation failed: ${e.message}`, 'error'),
      },
    );
  }

  function handleRegenerateScene(sceneId: string) {
    setRegeneratingScene(sceneId);
    regenerateScene.mutate(
      { draft_id: draftId, scene_id: sceneId },
      {
        onSuccess: (res) => toast.showToast(`Regenerated ${res?.created ?? 0} shot plans`, 'success'),
        onError: (e) => toast.showToast(e.message, 'error'),
        onSettled: () => setRegeneratingScene(null),
      },
    );
  }

  function handleDeleteAll() {
    if (!confirm('Delete all shot plans for this draft? This cannot be undone.')) return;
    deleteAll.mutate(
      { draft_id: draftId },
      {
        onSuccess: () => toast.showToast('All shot plans deleted', 'success'),
        onError: (e) => toast.showToast(e.message, 'error'),
      },
    );
  }

  function handleToggleKey(planId: string, isKeyShot: boolean) {
    toggleKey.mutate(
      { shot_plan_id: planId, draft_id: draftId, is_key_shot: isKeyShot },
      { onError: (e) => toast.showToast(e.message, 'error') },
    );
  }

  function handleDeletePlan(planId: string) {
    deletePlan.mutate(
      { shot_plan_id: planId, draft_id: draftId },
      { onError: (e) => toast.showToast(e.message, 'error') },
    );
  }

  const plansByScene = new Map<string, DocumentationShotPlan[]>();
  const unassigned: DocumentationShotPlan[] = [];
  for (const plan of shotPlans) {
    if (plan.scene_id) {
      const scenePlans = plansByScene.get(plan.scene_id);
      if (scenePlans) {
        scenePlans.push(plan);
      } else {
        plansByScene.set(plan.scene_id, [plan]);
      }
    } else {
      unassigned.push(plan);
    }
  }

  const summaryData = summary.data;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Film size={18} className="text-slate-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Shot Plans</h3>
            <p className="text-xs text-slate-500">
              {hasPlans
                ? `${shotPlans.length} shots across ${summaryData?.scenes_with_shots.size ?? 0} scenes`
                : 'No shot plans yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPlans && (
            <>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                <button
                  onClick={() => setView('grouped')}
                  className={`px-3 py-1.5 transition-colors ${view === 'grouped' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Grouped
                </button>
                <button
                  onClick={() => setView('flat')}
                  className={`px-3 py-1.5 transition-colors ${view === 'flat' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Flat
                </button>
              </div>

              <button
                onClick={() => handleGenerate(true)}
                disabled={generate.isPending}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {generate.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Regenerate All
              </button>

              <button
                onClick={handleDeleteAll}
                disabled={deleteAll.isPending}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-100 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={12} />
                Clear All
              </button>
            </>
          )}

          {!hasPlans && (
            <button
              onClick={() => handleGenerate(false)}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Generate Shot Plans
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {hasPlans && summaryData && (
        <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <Camera size={13} className="text-slate-400" />
            <span><strong className="text-slate-800">{summaryData.total}</strong> total shots</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span><strong className="text-slate-800">{summaryData.key_shot_count}</strong> key shots</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-slate-400" />
            <span><strong className="text-slate-800">{summaryData.scenes_with_shots.size}</strong> scenes covered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            <span>Avg <strong className="text-slate-800">{summaryData.avg_duration_seconds.toFixed(1)}s</strong> per shot</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {plansLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : !hasPlans ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Film size={40} className="text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">No shot plans yet</p>
            <p className="text-xs text-slate-400 max-w-xs mb-6">
              Shot plans define how each scene is filmed — zoom regions, callouts, transitions, and emphasis levels.
            </p>
            {scenes.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                <AlertCircle size={13} />
                Run Playwright capture first to generate scenes
              </div>
            ) : (
              <button
                onClick={() => handleGenerate(false)}
                disabled={generate.isPending}
                className="flex items-center gap-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Auto-generate from {scenes.length} scenes
              </button>
            )}
          </div>
        ) : view === 'flat' ? (
          <div className="space-y-2">
            <ShotTimelineView plans={shotPlans} />
            <div className="mt-4 space-y-2">
              {shotPlans.map((plan, i) => (
                <ShotPlanCard
                  key={plan.id}
                  plan={plan}
                  index={i}
                  onToggleKey={() => handleToggleKey(plan.id, !plan.is_key_shot)}
                  onDelete={() => handleDeletePlan(plan.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {scenes.map((scene, sceneIndex) => {
              const scenePlans = plansByScene.get(scene.id) ?? [];
              return (
                <SceneGroup
                  key={scene.id}
                  sceneId={scene.id}
                  sceneTitle={scene.title}
                  sceneIndex={sceneIndex}
                  plans={scenePlans}
                  draftId={draftId}
                  onToggleKey={handleToggleKey}
                  onDeletePlan={handleDeletePlan}
                  onRegenerateScene={handleRegenerateScene}
                  isRegenerating={regeneratingScene === scene.id}
                />
              );
            })}

            {unassigned.length > 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <p className="text-xs text-slate-400 font-medium mb-2 px-1">Unassigned shots</p>
                <div className="space-y-2">
                  {unassigned.map((plan, i) => (
                    <ShotPlanCard
                      key={plan.id}
                      plan={plan}
                      index={i}
                      onToggleKey={() => handleToggleKey(plan.id, !plan.is_key_shot)}
                      onDelete={() => handleDeletePlan(plan.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

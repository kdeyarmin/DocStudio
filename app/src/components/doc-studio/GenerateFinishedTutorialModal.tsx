import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Clapperboard, Cpu, Film, Clock, Captions, Layers, ChevronRight, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Loader as Loader2, Info, Film as ReelIcon, Mic, FolderOpen, Sparkles, RotateCcw, ExternalLink, SlidersHorizontal } from 'lucide-react';
import {
  RenderEngineProvider,
  RenderMode,
  RENDER_ENGINE_LABELS,
  RENDER_ENGINE_CAPABILITIES,
} from '../../types/documentation';
import {
  TutorialFactoryOptions,
  TutorialFactoryResult,
  PipelineStageResult,
  LiveStageStatus,
  DraftAssetSummary,
  PIPELINE_STAGE_NAMES,
  generateFinishedTutorial,
  resolveReusableDraftAssets,
  summarizePipelineResults,
} from '../../lib/tutorialFactoryOrchestrator';
import AdaptivePresetSelector from './AdaptivePresetSelector';
import { getPresetByMode, type AdaptivePreset } from '../../lib/renderPresets';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  draftId: string;
  organizationId: string;
  draftTitle: string;
  onClose: () => void;
  onJobStarted?: (jobId: string) => void;
}

type Step = 'configure' | 'running' | 'done';

interface LiveStage {
  name: string;
  status: LiveStageStatus;
  durationMs?: number;
  detail?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOLUTION_OPTIONS = [
  { value: '720p' as const, label: '720p HD' },
  { value: '1080p' as const, label: '1080p Full HD' },
  { value: '4k' as const, label: '4K Ultra HD' },
];

const FRAMERATE_OPTIONS = [
  { value: 24 as const, label: '24 fps (Cinematic)' },
  { value: 30 as const, label: '30 fps (Standard)' },
  { value: 60 as const, label: '60 fps (Smooth)' },
];

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageRow({ stage }: { stage: LiveStage }) {
  const statusConfig: Record<LiveStageStatus, { icon: React.ReactNode; rowCls: string; labelCls: string }> = {
    pending: {
      icon: <div className="w-4 h-4 rounded-full border-2 border-slate-300" />,
      rowCls: 'bg-slate-50',
      labelCls: 'text-slate-400',
    },
    running: {
      icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
      rowCls: 'bg-blue-50 border border-blue-100',
      labelCls: 'text-blue-800 font-medium',
    },
    completed: {
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      rowCls: 'bg-slate-50',
      labelCls: 'text-slate-700',
    },
    skipped: {
      icon: <CheckCircle className="w-4 h-4 text-sky-400" />,
      rowCls: 'bg-sky-50',
      labelCls: 'text-sky-700',
    },
    failed: {
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      rowCls: 'bg-red-50',
      labelCls: 'text-red-700',
    },
  };

  const cfg = statusConfig[stage.status];

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${cfg.rowCls}`}>
      <div className="flex-shrink-0">{cfg.icon}</div>
      <span className={`text-sm flex-1 ${cfg.labelCls}`}>{stage.name}</span>
      {stage.status === 'skipped' && (
        <span className="text-xs text-sky-500 font-medium bg-sky-100 px-2 py-0.5 rounded-full">reused</span>
      )}
      {stage.status === 'running' && (
        <span className="text-xs text-blue-400 animate-pulse">running…</span>
      )}
      {stage.durationMs !== undefined && stage.status !== 'running' && (
        <span className="text-xs text-slate-400">{formatElapsed(stage.durationMs)}</span>
      )}
    </div>
  );
}

function AssetReadinessPanel({ summary, loading }: { summary: DraftAssetSummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-4 bg-slate-200 rounded w-3/4" />
        ))}
      </div>
    );
  }
  if (!summary) return null;

  const rows: { icon: React.ReactNode; label: string; value: string; ok: boolean }[] = [
    {
      icon: <ReelIcon className="w-3.5 h-3.5" />,
      label: 'Scenes',
      value: summary.sceneCount > 0 ? `${summary.sceneCount} scenes ready` : 'No scenes found',
      ok: summary.sceneCount > 0,
    },
    {
      icon: <Mic className="w-3.5 h-3.5" />,
      label: 'Narration',
      value: summary.narrationCount > 0 ? `${summary.narrationCount} segments ready` : 'No narration segments',
      ok: summary.narrationCount > 0,
    },
    {
      icon: <FolderOpen className="w-3.5 h-3.5" />,
      label: 'Render project',
      value: summary.hasRenderProject ? 'Existing project will be reused' : 'Will be created',
      ok: summary.hasRenderProject,
    },
    {
      icon: <Sparkles className="w-3.5 h-3.5" />,
      label: 'Last render',
      value: summary.latestCompletedJobAt
        ? `${summary.latestCompletedJobMode ?? 'render'} · ${formatRelativeDate(summary.latestCompletedJobAt)}`
        : 'First render',
      ok: !!summary.latestCompletedJobAt,
    },
  ];

  const reusableCount = [
    summary.hasRenderProject,
    summary.hasCachedManifest && !!summary.latestCompletedJobAt,
  ].filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 px-3 py-2.5">
          <span className={r.ok ? 'text-slate-400' : 'text-amber-500'}>{r.icon}</span>
          <span className="text-xs text-slate-500 w-24 flex-shrink-0">{r.label}</span>
          <span className={`text-xs flex-1 ${r.ok ? 'text-slate-700' : 'text-amber-700'}`}>{r.value}</span>
          {r.ok
            ? <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            : <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          }
        </div>
      ))}
      {reusableCount > 0 && (
        <div className="px-3 py-2 flex items-center gap-2 bg-sky-50 rounded-b-xl">
          <Info className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
          <span className="text-xs text-sky-700">{reusableCount} phase{reusableCount !== 1 ? 's' : ''} can be skipped — existing assets will be reused</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GenerateFinishedTutorialModal({
  draftId,
  organizationId,
  draftTitle,
  onClose,
  onJobStarted,
}: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [engine, setEngine] = useState<RenderEngineProvider>('mock');
  const [selectedPreset, setSelectedPreset] = useState<AdaptivePreset>(() => getPresetByMode('standard_training'));
  const [renderMode, setRenderMode] = useState<RenderMode>('standard_training');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);
  const [captionMode, setCaptionMode] = useState<'auto' | 'none' | 'burn_in'>('auto');
  const [includeOverlays, setIncludeOverlays] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [assetSummary, setAssetSummary] = useState<DraftAssetSummary | null>(null);
  const [assetLoading, setAssetLoading] = useState(true);

  const [liveStages, setLiveStages] = useState<LiveStage[]>(
    PIPELINE_STAGE_NAMES.map(n => ({ name: n, status: 'pending' as LiveStageStatus }))
  );
  const [result, setResult] = useState<TutorialFactoryResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const caps = RENDER_ENGINE_CAPABILITIES[engine as RenderEngineProvider];

  function handlePresetChange(preset: AdaptivePreset) {
    setSelectedPreset(preset);
    setRenderMode(preset.mode);
    setResolution(preset.outputResolution);
    setFrameRate(preset.frameRate);
    setCaptionMode(preset.captionMode);
    setIncludeOverlays(preset.includeOverlays);
  }

  useEffect(() => {
    resolveReusableDraftAssets(draftId)
      .then(s => setAssetSummary(s))
      .catch(() => setAssetSummary(null))
      .finally(() => setAssetLoading(false));
  }, [draftId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStageStart = useCallback((_stageName: string, idx: number) => {
    setLiveStages(prev => prev.map((s, i) =>
      i === idx ? { ...s, status: 'running' } : s
    ));
  }, []);

  const handleStageComplete = useCallback((stageResult: PipelineStageResult, idx: number) => {
    setLiveStages(prev => prev.map((s, i) =>
      i === idx
        ? { ...s, status: stageResult.status, durationMs: stageResult.durationMs, detail: stageResult.detail }
        : s
    ));
  }, []);

  async function handleGenerate() {
    setStep('running');
    setLiveStages(PIPELINE_STAGE_NAMES.map(n => ({ name: n, status: 'pending' as LiveStageStatus })));
    setResult(null);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);

    const opts: TutorialFactoryOptions = {
      draftId,
      organizationId,
      engineProvider: engine,
      renderMode,
      captionMode,
      includeOverlays,
      includeBurnInCaptions: captionMode === 'burn_in',
      includeExternalSubtitles: captionMode === 'auto',
      outputResolution: resolution,
      frameRate,
      onStageStart: handleStageStart,
      onStageComplete: handleStageComplete,
    };

    try {
      const res = await generateFinishedTutorial(opts);
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(res.totalElapsedMs);
      setResult(res);
      setStep('done');
      if (res.success && res.jobId) {
        onJobStarted?.(res.jobId);
      }
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(Date.now() - startTimeRef.current);
      setResult({
        success: false,
        jobId: null,
        renderProjectId: null,
        stages: [],
        warnings: [],
        error: err instanceof Error ? err.message : 'Unexpected error',
        totalElapsedMs: Date.now() - startTimeRef.current,
      });
      setStep('done');
    }
  }

  const completedCount = liveStages.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const total = PIPELINE_STAGE_NAMES.length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Generate Finished Tutorial</h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{draftTitle}</p>
            </div>
          </div>
          {step !== 'running' && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>

        {/* ── Configure Step ─────────────────────────────────────────────────── */}
        {step === 'configure' && (
          <div className="p-6 space-y-6">

            {/* Engine */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Render Engine</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(RENDER_ENGINE_LABELS) as RenderEngineProvider[]).map((e) => {
                  const c = RENDER_ENGINE_CAPABILITIES[e];
                  const selected = engine === e;
                  return (
                    <button
                      key={e}
                      onClick={() => setEngine(e)}
                      className={`relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                        selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm font-medium text-slate-900">{RENDER_ENGINE_LABELS[e]}</span>
                      {!c.available && (
                        <span className="text-xs text-amber-600 font-medium mt-0.5">Coming soon</span>
                      )}
                      {c.available && (
                        <span className="text-xs text-green-600 font-medium mt-0.5">Available</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!caps.available && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  {RENDER_ENGINE_LABELS[engine as RenderEngineProvider]} is scaffolded but not yet connected. A mock render will run instead.
                </p>
              )}
            </section>

            {/* Adaptive Preset Selector */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Film className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Output Preset</h3>
              </div>
              <AdaptivePresetSelector selected={renderMode} onChange={handlePresetChange} />
            </section>

            {/* Advanced Overrides (collapsible) */}
            <section>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showAdvanced ? 'Hide advanced overrides' : 'Override preset settings'}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
                  {/* Output Settings */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">Output Settings</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Resolution</label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as typeof resolution)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {RESOLUTION_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Frame Rate</label>
                        <select
                          value={frameRate}
                          onChange={(e) => setFrameRate(Number(e.target.value) as typeof frameRate)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {FRAMERATE_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Captions & Overlays */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Captions className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">Captions & Overlays</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Caption Mode</label>
                        <div className="flex gap-2">
                          {(['auto', 'burn_in', 'none'] as const).map((c) => (
                            <button
                              key={c}
                              onClick={() => setCaptionMode(c)}
                              className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-all ${
                                captionMode === c
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {c === 'auto' ? 'External SRT' : c === 'burn_in' ? 'Burned In' : 'None'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={() => setIncludeOverlays(!includeOverlays)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${includeOverlays ? 'bg-slate-900' : 'bg-slate-300'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeOverlays ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm text-slate-700">Include UI callout overlays</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Asset Readiness */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Asset Readiness</h3>
              </div>
              <AssetReadinessPanel summary={assetSummary} loading={assetLoading} />
            </section>

            {/* Zero-scenes warning */}
            {!assetLoading && assetSummary && assetSummary.sceneCount === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-800">No scenes found</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This draft has no scenes yet. The render will produce an empty output. Go back and add steps, then generate scenes first using the Scenes tab.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                Est. {selectedPreset.estimatedTime} · {selectedPreset.outputSizeRange}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!assetLoading && assetSummary !== null && assetSummary.sceneCount === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!assetLoading && assetSummary?.sceneCount === 0 ? 'Add scenes before generating' : undefined}
                >
                  <Clapperboard className="w-4 h-4" />
                  Generate Tutorial
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Running Step ──────────────────────────────────────────────────── */}
        {step === 'running' && (
          <div className="p-6 space-y-5">
            {/* Header status */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-6 h-6 text-slate-700 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">Setting Up Render Pipeline</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {liveStages.find(s => s.status === 'running')?.name ?? 'Initializing…'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono text-slate-400">{formatElapsed(elapsedMs)}</p>
                <p className="text-xs text-slate-400">{completedCount}/{total} phases</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-slate-800 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / total) * 100}%` }}
              />
            </div>

            {/* Stage list */}
            <div className="space-y-1.5">
              {liveStages.map((s) => (
                <StageRow key={s.name} stage={s} />
              ))}
            </div>

            <p className="text-xs text-slate-400 text-center">
              The render job continues in the background after setup — monitor progress in the Render tab.
            </p>
          </div>
        )}

        {/* ── Done Step ─────────────────────────────────────────────────────── */}
        {step === 'done' && result && (() => {
          const skippedCount = result.stages.filter(s => s.status === 'skipped').length;
          return (
            <div className="p-6 space-y-4">
              {/* Result banner */}
              <div className={`flex items-start gap-3 p-4 rounded-xl ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {result.success
                  ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? 'Render job queued successfully' : 'Pipeline failed'}
                  </p>
                  <p className="text-xs mt-0.5 text-slate-600">
                    {result.success ? summarizePipelineResults(result) : result.error}
                  </p>
                  {result.success && result.jobId && (
                    <p className="text-xs text-slate-400 mt-1 font-mono">Job: {result.jobId.slice(0, 8)}…</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                  {formatElapsed(result.totalElapsedMs)}
                </span>
              </div>

              {/* Skipped assets banner */}
              {skippedCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-sky-50 border border-sky-100 rounded-xl">
                  <Info className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className="text-xs text-sky-700">
                    {skippedCount} phase{skippedCount !== 1 ? 's' : ''} skipped — existing assets reused to save time
                  </span>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Warnings</p>
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Pipeline stages */}
              {result.stages.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pipeline Phases</p>
                  <div className="space-y-1.5">
                    {result.stages.map((s) => (
                      <StageRow
                        key={s.stage}
                        stage={{ name: s.stage, status: s.status, durationMs: s.durationMs, detail: s.detail }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => setStep('configure')}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {result.success ? 'Generate Again' : 'Edit Settings'}
                </button>
                <div className="flex items-center gap-2">
                  {!result.success && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  )}
                  {result.success && result.jobId && (
                    <button
                      onClick={() => {
                        onJobStarted?.(result.jobId!);
                        onClose();
                      }}
                      className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Render Job
                    </button>
                  )}
                  {result.success && !result.jobId && (
                    <button
                      onClick={onClose}
                      className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export { GenerateFinishedTutorialModal };

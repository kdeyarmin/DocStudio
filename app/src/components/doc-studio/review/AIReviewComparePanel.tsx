import { useState, useMemo } from 'react';
import {
  TriangleAlert as AlertTriangle,
  Circle as XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  GitCompareArrows,
  Loader as Loader2,
  CircleCheck as CheckCircle,
} from 'lucide-react';
import { useAIReviewRuns } from '../../../hooks/useDocStudioAIReview';
import type { AIReviewRun, AIReviewVerdict } from '../../../types/doc-studio-review';

interface Props {
  draftId: string;
  organizationId: string;
}

const VERDICT_CONFIG: Record<AIReviewVerdict, { label: string; classes: string }> = {
  pass:            { label: 'Pass',          classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pass_with_notes: { label: 'Pass w/ Notes', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  needs_work:      { label: 'Needs Work',    classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  fail:            { label: 'Blocked',       classes: 'bg-red-100 text-red-700 border-red-200' },
};

const VERDICT_RANK: Record<AIReviewVerdict, number> = {
  pass: 4, pass_with_notes: 3, needs_work: 2, fail: 1,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-400 font-medium">
        <Minus className="w-3 h-3" /> 0
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-semibold">
        <TrendingUp className="w-3 h-3" />+{delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-semibold">
      <TrendingDown className="w-3 h-3" />{delta}
    </span>
  );
}

type RunResult = {
  hard_blockers?: Array<{ code: string; category: string; description: string; resolution_hint: string }>;
  soft_blockers?: Array<{ code: string; category: string; description: string; resolution_hint: string }>;
  top_recommendations?: string[];
  approval_summary?: string;
};

function parseRunResult(run: AIReviewRun): RunResult {
  return (run.result_json ?? {}) as RunResult;
}

function getBlockerCodes(result: RunResult): { hard: Set<string>; soft: Set<string> } {
  return {
    hard: new Set((result.hard_blockers ?? []).map(b => b.code)),
    soft: new Set((result.soft_blockers ?? []).map(b => b.code)),
  };
}

interface RunCardProps {
  run: AIReviewRun;
  label: string;
}

function RunCard({ run, label }: RunCardProps) {
  const cfg = VERDICT_CONFIG[run.verdict];
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-[11px] text-slate-400">{formatDate(run.created_at)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <ScoreRing score={run.overall_score} size={56} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-slate-700">{Math.round(run.overall_score)}%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.classes}`}>
            {cfg.label}
          </span>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-500" />
              {run.hard_blocker_count} hard
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              {run.soft_blocker_count} soft
            </span>
          </div>
          {run.model && (
            <div className="text-[10px] text-slate-400 font-mono">{run.model}</div>
          )}
        </div>
      </div>
      {run.run_label && (
        <p className="text-[11px] text-slate-400 italic">{run.run_label}</p>
      )}
    </div>
  );
}

export function AIReviewComparePanel({ draftId }: Props) {
  const { data: runs = [], isLoading } = useAIReviewRuns(draftId, 'approval_readiness');

  const [baseId, setBaseId] = useState<string>('');
  const [compareId, setCompareId] = useState<string>('');

  const sortedRuns = useMemo(() =>
    [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [runs]
  );

  const resolvedBaseId   = baseId    || sortedRuns[1]?.id || '';
  const resolvedCompareId = compareId || sortedRuns[0]?.id || '';

  const baseRun    = sortedRuns.find(r => r.id === resolvedBaseId)    ?? null;
  const compareRun = sortedRuns.find(r => r.id === resolvedCompareId) ?? null;

  const analysis = useMemo(() => {
    if (!baseRun || !compareRun || baseRun.id === compareRun.id) return null;

    const baseResult    = parseRunResult(baseRun);
    const compareResult = parseRunResult(compareRun);

    const baseCodes    = getBlockerCodes(baseResult);
    const compareCodes = getBlockerCodes(compareResult);

    const resolvedHard = [...baseCodes.hard].filter(c => !compareCodes.hard.has(c));
    const newHard      = [...compareCodes.hard].filter(c => !baseCodes.hard.has(c));
    const resolvedSoft = [...baseCodes.soft].filter(c => !compareCodes.soft.has(c));
    const newSoft      = [...compareCodes.soft].filter(c => !baseCodes.soft.has(c));

    const scoreDelta   = Math.round(compareRun.overall_score - baseRun.overall_score);
    const hardDelta    = compareRun.hard_blocker_count - baseRun.hard_blocker_count;
    const softDelta    = compareRun.soft_blocker_count - baseRun.soft_blocker_count;
    const verdictDelta = VERDICT_RANK[compareRun.verdict as AIReviewVerdict] - VERDICT_RANK[baseRun.verdict as AIReviewVerdict];

    const baseBlockerMap    = new Map(
      [...(baseResult.hard_blockers ?? []), ...(baseResult.soft_blockers ?? [])].map(b => [b.code, b])
    );
    const compareBlockerMap = new Map(
      [...(compareResult.hard_blockers ?? []), ...(compareResult.soft_blockers ?? [])].map(b => [b.code, b])
    );

    return {
      scoreDelta, hardDelta, softDelta, verdictDelta,
      resolvedHard, newHard, resolvedSoft, newSoft,
      baseBlockerMap, compareBlockerMap,
    };
  }, [baseRun, compareRun]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading runs…</span>
      </div>
    );
  }

  if (runs.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <GitCompareArrows className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">Not enough runs to compare</p>
        <p className="text-xs text-slate-400 mt-1">Run AI review at least twice to compare reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-700">Compare AI Review Runs</h3>
      </div>

      {/* Run selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
            Baseline Run
          </label>
          <select
            value={resolvedBaseId}
            onChange={e => setBaseId(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {sortedRuns.map((r, i) => (
              <option key={r.id} value={r.id} disabled={r.id === resolvedCompareId}>
                {i === 0 ? 'Latest' : `Run ${sortedRuns.length - i}`} — {formatDate(r.created_at)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
            Comparison Run
          </label>
          <select
            value={resolvedCompareId}
            onChange={e => setCompareId(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {sortedRuns.map((r, i) => (
              <option key={r.id} value={r.id} disabled={r.id === resolvedBaseId}>
                {i === 0 ? 'Latest' : `Run ${sortedRuns.length - i}`} — {formatDate(r.created_at)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {baseRun && compareRun && baseRun.id !== compareRun.id && (
        <>
          {/* Side-by-side run cards */}
          <div className="flex gap-3">
            <RunCard run={baseRun}    label="Baseline" />
            <RunCard run={compareRun} label="Comparison (newer)" />
          </div>

          {analysis && (
            <>
              {/* Delta summary row */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Changes
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 mb-1">Overall Score</div>
                    <DeltaBadge delta={analysis.scoreDelta} />
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {Math.round(baseRun.overall_score)}% → {Math.round(compareRun.overall_score)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 mb-1">Hard Blockers</div>
                    <DeltaBadge delta={-analysis.hardDelta} />
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {baseRun.hard_blocker_count} → {compareRun.hard_blocker_count}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 mb-1">Soft Blockers</div>
                    <DeltaBadge delta={-analysis.softDelta} />
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {baseRun.soft_blocker_count} → {compareRun.soft_blocker_count}
                    </div>
                  </div>
                </div>
                {analysis.verdictDelta !== 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <span>Verdict:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${VERDICT_CONFIG[baseRun.verdict as AIReviewVerdict].classes}`}>
                      {VERDICT_CONFIG[baseRun.verdict as AIReviewVerdict].label}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${VERDICT_CONFIG[compareRun.verdict as AIReviewVerdict].classes}`}>
                      {VERDICT_CONFIG[compareRun.verdict as AIReviewVerdict].label}
                    </span>
                    {analysis.verdictDelta > 0
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    }
                  </div>
                )}
              </div>

              {/* Resolved blockers */}
              {(analysis.resolvedHard.length > 0 || analysis.resolvedSoft.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700">
                      Resolved ({analysis.resolvedHard.length + analysis.resolvedSoft.length})
                    </span>
                    <span className="text-[11px] text-slate-400">blockers present in baseline but gone in comparison</span>
                  </div>
                  {analysis.resolvedHard.map(code => {
                    const b = analysis.baseBlockerMap.get(code);
                    return (
                      <div key={code} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">HARD — RESOLVED</span>
                            <span className="text-[10px] text-slate-400 font-mono">{code}</span>
                          </div>
                          <p className="text-xs text-slate-700">{b?.description ?? code}</p>
                        </div>
                      </div>
                    );
                  })}
                  {analysis.resolvedSoft.map(code => {
                    const b = analysis.baseBlockerMap.get(code);
                    return (
                      <div key={code} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">SOFT — RESOLVED</span>
                            <span className="text-[10px] text-slate-400 font-mono">{code}</span>
                          </div>
                          <p className="text-xs text-slate-700">{b?.description ?? code}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* New blockers */}
              {(analysis.newHard.length > 0 || analysis.newSoft.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-semibold text-red-700">
                      New Issues ({analysis.newHard.length + analysis.newSoft.length})
                    </span>
                    <span className="text-[11px] text-slate-400">blockers not in baseline, appeared in comparison</span>
                  </div>
                  {analysis.newHard.map(code => {
                    const b = analysis.compareBlockerMap.get(code);
                    return (
                      <div key={code} className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
                        <XCircle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">HARD — NEW</span>
                            <span className="text-[10px] text-slate-400 font-mono">{code}</span>
                          </div>
                          <p className="text-xs text-slate-700">{b?.description ?? code}</p>
                          {b?.resolution_hint && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">{b.resolution_hint}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {analysis.newSoft.map(code => {
                    const b = analysis.compareBlockerMap.get(code);
                    return (
                      <div key={code} className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">SOFT — NEW</span>
                            <span className="text-[10px] text-slate-400 font-mono">{code}</span>
                          </div>
                          <p className="text-xs text-slate-700">{b?.description ?? code}</p>
                          {b?.resolution_hint && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">{b.resolution_hint}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Persisted blockers */}
              {(() => {
                const compareResult = parseRunResult(compareRun);
                const baseCodes = getBlockerCodes(parseRunResult(baseRun));
                const persistedHard = (compareResult.hard_blockers ?? [])
                  .filter(b => baseCodes.hard.has(b.code));
                const persistedSoft = (compareResult.soft_blockers ?? [])
                  .filter(b => baseCodes.soft.has(b.code));
                if (persistedHard.length === 0 && persistedSoft.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500">
                        Persisted ({persistedHard.length + persistedSoft.length})
                      </span>
                      <span className="text-[11px] text-slate-400">unchanged between runs</span>
                    </div>
                    {[...persistedHard.map(b => ({ ...b, type: 'hard' as const })), ...persistedSoft.map(b => ({ ...b, type: 'soft' as const }))].map(b => (
                      <div key={b.code} className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start gap-2.5">
                        {b.type === 'hard'
                          ? <XCircle className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                          : <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase">{b.type} — persisted</span>
                            <span className="text-[10px] text-slate-400 font-mono">{b.code}</span>
                          </div>
                          <p className="text-xs text-slate-600">{b.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* No change message */}
              {analysis.resolvedHard.length === 0 && analysis.resolvedSoft.length === 0 &&
               analysis.newHard.length === 0 && analysis.newSoft.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <Minus className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-sm text-slate-500 font-medium">No blocker changes between runs</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Score delta: <DeltaBadge delta={analysis.scoreDelta} />
                  </p>
                </div>
              )}
            </>
          )}

          {baseRun.id === compareRun.id && (
            <div className="text-center py-6 text-sm text-slate-400">
              Select two different runs to compare.
            </div>
          )}
        </>
      )}
    </div>
  );
}

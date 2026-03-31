import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Loader as Loader2, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Info, ChevronDown, ChevronUp, Camera, FileText, Mic, Image, Clapperboard, Film, Captions, Video, Activity, GitBranch, TrendingUp, TrendingDown, Minus, Play, Zap, Sparkles, RotateCcw, Clock, CircleCheck as CheckCircle } from 'lucide-react';
import {
  useDocStudioIntegrityReport,
  useDocStudioIntegrityHistory,
  useRunIntegrityCheck,
  useMarkDraftValidated,
  useRequestRecapture,
  useResolveDrift,
  useRegenerateContent,
} from '../../../hooks/useDocStudioIntegrity';
import { useStartRenderJob } from '../../../hooks/useDocStudioRenderJobs';
import { useToast } from '../../../lib/toast';
import type {
  TutorialIntegrityReport,
  IntegrityStatus,
  IntegrityCategory,
  IntegrityWarning,
  IntegrityFailure,
  IntegrityRecommendation,
} from '../../../types/documentation';
import {
  INTEGRITY_STATUS_LABELS,
  INTEGRITY_STATUS_COLORS,
  INTEGRITY_CATEGORY_LABELS,
} from '../../../types/documentation';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_GAUGE_COLOR: Record<IntegrityStatus, string> = {
  unknown: '#94a3b8',
  healthy: '#16a34a',
  warning: '#d97706',
  needs_review: '#ea580c',
  needs_recapture: '#dc2626',
  outdated: '#e11d48',
  incomplete: '#ca8a04',
  failed_validation: '#991b1b',
};

const CATEGORY_ICON: Record<IntegrityCategory, React.ReactElement> = {
  capture:   <Camera size={14} />,
  content:   <FileText size={14} />,
  narration: <Mic size={14} />,
  screenshot:<Image size={14} />,
  scene:     <Clapperboard size={14} />,
  shot_plan: <Film size={14} />,
  caption:   <Captions size={14} />,
  render:    <Video size={14} />,
  drift:     <Activity size={14} />,
};

const CATEGORY_SCORE_KEY: Record<IntegrityCategory, keyof TutorialIntegrityReport> = {
  capture:   'capture_integrity_score',
  content:   'content_integrity_score',
  narration: 'narration_integrity_score',
  screenshot:'screenshot_integrity_score',
  scene:     'scene_integrity_score',
  shot_plan: 'shot_plan_integrity_score',
  caption:   'caption_integrity_score',
  render:    'render_integrity_score',
  drift:     'drift_integrity_score',
};

const INTEGRITY_CATEGORIES: IntegrityCategory[] = [
  'capture', 'content', 'narration', 'screenshot', 'scene',
  'shot_plan', 'caption', 'render', 'drift',
];

const PRIORITY_BORDER: Record<'high' | 'medium' | 'low', string> = {
  high:   'border-l-red-400',
  medium: 'border-l-amber-400',
  low:    'border-l-blue-400',
};

const PRIORITY_LABEL_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high:   'text-red-600',
  medium: 'text-amber-600',
  low:    'text-blue-600',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string, referenceMs: number): string {
  const ms = referenceMs - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-slate-200';
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-amber-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreBorderColor(score: number | null, hasFailures: boolean): string {
  if (hasFailures) return 'border-red-200 bg-red-50/30';
  if (score === null) return 'border-slate-100';
  if (score >= 90) return 'border-green-100 bg-green-50/20';
  if (score >= 75) return 'border-amber-100 bg-amber-50/20';
  if (score >= 50) return 'border-orange-100 bg-orange-50/20';
  return 'border-red-200 bg-red-50/30';
}

// ─── DonutGauge ───────────────────────────────────────────────────────────────

function DonutGauge({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const radius = 46;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const offset = circumference * arcFraction * (1 - score / 100);
  const rotateAngle = 180 - (360 * (1 - arcFraction)) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={10}
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeLinecap="round" transform={`rotate(${rotateAngle} ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${arcLength - offset} ${circumference - (arcLength - offset)}`}
        strokeLinecap="round" transform={`rotate(${rotateAngle} ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.22} fontWeight="700" fill={color}>{Math.round(score)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={size * 0.09} fill="#94a3b8">/ 100</text>
    </svg>
  );
}

// ─── ScoreSparkline ───────────────────────────────────────────────────────────

function ScoreSparkline({ scores, width = 180, height = 36 }: { scores: number[]; width?: number; height?: number }) {
  if (scores.length < 2) return null;
  const min = Math.min(...scores);
  const max = Math.max(...scores, min + 5);
  const range = max - min || 1;
  const pad = 4;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * (width - pad * 2) + pad;
    const y = height - ((s - min) / range) * (height - pad * 2) - pad;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = scores[scores.length - 1];
  const lastX = width - pad;
  const lastY = height - ((last - min) / range) * (height - pad * 2) - pad;
  const color = last >= 90 ? '#16a34a' : last >= 75 ? '#d97706' : last >= 50 ? '#ea580c' : '#dc2626';
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}

// ─── WarningItem ──────────────────────────────────────────────────────────────

function WarningItem({ w, compact = false }: { w: IntegrityWarning; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 ${compact ? 'py-1' : 'py-1.5 border-b border-amber-50 last:border-0'}`}>
      <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-700">{w.message}</span>
        {!compact && (
          <span className="ml-2 text-[10px] text-slate-400">{INTEGRITY_CATEGORY_LABELS[w.category]}</span>
        )}
        {w.field && <span className="ml-1 text-[10px] font-mono text-slate-400">{w.field}</span>}
      </div>
    </div>
  );
}

// ─── FailureItem ──────────────────────────────────────────────────────────────

function FailureItem({ f, compact = false }: { f: IntegrityFailure; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 ${compact ? 'py-1' : 'py-1.5 border-b border-red-50 last:border-0'}`}>
      <XCircle size={12} className={`flex-shrink-0 mt-0.5 ${f.blocking ? 'text-red-600' : 'text-orange-500'}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-700">{f.message}</span>
        {f.blocking && (
          <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">blocking</span>
        )}
        {!compact && (
          <span className="ml-1 text-[10px] text-slate-400">{INTEGRITY_CATEGORY_LABELS[f.category]}</span>
        )}
      </div>
    </div>
  );
}

// ─── CategoryScorecard ────────────────────────────────────────────────────────

interface CategoryScorecardProps {
  category: IntegrityCategory;
  score: number | null;
  warnings: IntegrityWarning[];
  failures: IntegrityFailure[];
  recommendations: IntegrityRecommendation[];
  actionLabel?: string;
  actionIcon?: React.ReactElement;
  onAction?: () => void;
  actionPending?: boolean;
}

function CategoryScorecard({
  category, score, warnings, failures, recommendations,
  actionLabel, actionIcon, onAction, actionPending,
}: CategoryScorecardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = warnings.length > 0 || failures.length > 0;
  const borderBg = scoreBorderColor(score, failures.length > 0);

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${borderBg}`}>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className={`flex-shrink-0 ${scoreColor(score)}`}>
          {CATEGORY_ICON[category]}
        </span>
        <span className="text-xs font-medium text-slate-700 w-24 flex-shrink-0 truncate">
          {INTEGRITY_CATEGORY_LABELS[category]}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-white/70 overflow-hidden mx-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(score)}`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-7 text-right flex-shrink-0 ${scoreColor(score)}`}>
          {score !== null ? Math.round(score) : '–'}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {failures.length > 0 && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
              {failures.length}✗
            </span>
          )}
          {warnings.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              {warnings.length}⚠
            </span>
          )}
          {!hasIssues && score !== null && score >= 90 && (
            <CheckCircle size={12} className="text-green-500" />
          )}
        </div>
        {expanded ? <ChevronUp size={12} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/60 space-y-2">
          {failures.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Failures</p>
              <div className="pl-1 space-y-0.5">
                {failures.map((f, i) => <FailureItem key={i} f={f} compact />)}
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Warnings</p>
              <div className="pl-1 space-y-0.5">
                {warnings.map((w, i) => <WarningItem key={i} w={w} compact />)}
              </div>
            </div>
          )}
          {recommendations.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Recommendations</p>
              <div className="pl-1 space-y-1">
                {recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className={`text-[9px] font-semibold uppercase mt-0.5 ${PRIORITY_LABEL_COLOR[r.priority]}`}>
                      {r.priority}
                    </span>
                    <span className="text-[11px] text-slate-600">{r.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!hasIssues && recommendations.length === 0 && (
            <p className="text-[11px] text-green-600 flex items-center gap-1.5 mt-1">
              <CheckCircle2 size={11} /> All checks passed for this category
            </p>
          )}
          {onAction && actionLabel && (
            <button
              onClick={(e) => { e.stopPropagation(); onAction(); }}
              disabled={actionPending}
              className="mt-1 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              {actionPending ? <Loader2 size={10} className="animate-spin" /> : (actionIcon ?? <Play size={10} />)}
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DriftStatusPanel ─────────────────────────────────────────────────────────

interface DriftStatusPanelProps {
  report: TutorialIntegrityReport;
  onResolveDrift: () => void;
  onRequestRecapture: () => void;
  resolvePending: boolean;
  recapturePending: boolean;
}

function DriftStatusPanel({ report, onResolveDrift, onRequestRecapture, resolvePending, recapturePending }: DriftStatusPanelProps) {
  const [now] = useState(() => Date.now());
  const driftScore = report.drift_integrity_score;
  const isCritical = driftScore !== null && driftScore < 50;
  const daysSinceCheck = Math.floor(
    (now - new Date(report.last_checked_at).getTime()) / 86400000
  );

  return (
    <div className={`rounded-xl border p-4 ${isCritical ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Activity size={14} className={isCritical ? 'text-rose-600' : 'text-amber-600'} />
          <span className={`text-sm font-semibold ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
            Drift {isCritical ? 'Critical' : 'Detected'}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          {driftScore !== null && (
            <span className={`text-xl font-bold ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>
              {Math.round(driftScore)}
              <span className="text-xs font-normal opacity-50">/100</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${isCritical ? 'bg-rose-100/60' : 'bg-amber-100/60'}`}>
          <Clock size={11} className="opacity-60" />
          <span className={`text-[11px] ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
            Checked {daysSinceCheck === 0 ? 'today' : `${daysSinceCheck}d ago`}
          </span>
        </div>
        <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${isCritical ? 'bg-rose-100/60' : 'bg-amber-100/60'}`}>
          <ShieldAlert size={11} className="opacity-60" />
          <span className={`text-[11px] ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
            Revalidation required
          </span>
        </div>
      </div>

      <p className={`text-xs mb-3 leading-relaxed ${isCritical ? 'text-rose-600' : 'text-amber-600'}`}>
        This tutorial has drifted from its source. Screenshots or content may no longer
        match the current application state.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onResolveDrift}
          disabled={resolvePending}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium disabled:opacity-50 transition-colors hover:bg-slate-50 shadow-sm ${isCritical ? 'border-rose-300 text-rose-700' : 'border-amber-300 text-amber-700'}`}
        >
          {resolvePending ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
          Resolve Drift
        </button>
        <button
          onClick={onRequestRecapture}
          disabled={recapturePending}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium disabled:opacity-50 transition-colors hover:bg-slate-50 shadow-sm ${isCritical ? 'border-rose-300 text-rose-700' : 'border-amber-300 text-amber-700'}`}
        >
          {recapturePending ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
          Request Recapture
        </button>
      </div>
    </div>
  );
}

// ─── ValidationHistory ────────────────────────────────────────────────────────

function ValidationHistory({ draftId }: { draftId: string }) {
  const [now] = useState(() => Date.now());
  const { data: history } = useDocStudioIntegrityHistory(draftId, 12);
  if (!history || history.length < 2) return null;

  const sorted = [...history].reverse();
  const scores = sorted.map(r => r.overall_score);
  const latest = scores[scores.length - 1];
  const previous = scores[scores.length - 2];
  const delta = latest - previous;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return (
    <div className="border border-slate-100 rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Validation History</span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
            {history.length} checks
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400">avg <span className="font-semibold text-slate-600">{avg}</span></span>
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
            {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {delta !== 0 ? `${delta > 0 ? '+' : ''}${Math.round(delta)}` : '—'}
          </span>
        </div>
      </div>

      <ScoreSparkline scores={scores} width={260} height={40} />

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-slate-400">
          {relativeTime(sorted[0].last_checked_at, now)}
        </span>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <span>min <span className="font-medium text-slate-600">{Math.min(...scores)}</span></span>
          <span>max <span className="font-medium text-slate-600">{Math.max(...scores)}</span></span>
        </div>
        <span className="text-[10px] text-slate-400">
          {relativeTime(sorted[sorted.length - 1].last_checked_at, now)}
        </span>
      </div>
    </div>
  );
}

// ─── RecommendationCard ───────────────────────────────────────────────────────

interface RecommendationCardProps {
  r: IntegrityRecommendation;
  onRerun?: () => void;
  onRecapture?: () => void;
  onRerender?: () => void;
  onRegen?: () => void;
  isRunning?: boolean;
  isCapturing?: boolean;
  isRendering?: boolean;
  isRegenerating?: boolean;
}

function RecommendationCard({ r, onRerun, onRecapture, onRerender, onRegen, isRunning, isCapturing, isRendering, isRegenerating }: RecommendationCardProps) {
  const lower = r.action.toLowerCase();
  let action: (() => void) | undefined;
  let actionLabel = '';
  let actionIcon = <Play size={10} />;
  let isPending = false;

  if ((lower.includes('recaptur') || lower.includes('capture') || lower.includes('screenshot')) && onRecapture) {
    action = onRecapture;
    actionLabel = 'Request Recapture';
    actionIcon = <Camera size={10} />;
    isPending = !!isCapturing;
  } else if ((lower.includes('render') || lower.includes('video')) && onRerender) {
    action = onRerender;
    actionLabel = 'Re-render';
    actionIcon = <Zap size={10} />;
    isPending = !!isRendering;
  } else if ((lower.includes('regenerat') || lower.includes('content') || lower.includes('generat')) && onRegen) {
    action = onRegen;
    actionLabel = 'Regenerate';
    actionIcon = <Sparkles size={10} />;
    isPending = !!isRegenerating;
  } else if (lower.includes('run') || lower.includes('check') || lower.includes('validat')) {
    action = onRerun;
    actionLabel = 'Re-run Check';
    actionIcon = <RefreshCw size={10} />;
    isPending = !!isRunning;
  }

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border-l-4 bg-white border border-slate-100 ${PRIORITY_BORDER[r.priority]}`}>
      <Info size={12} className={`flex-shrink-0 mt-0.5 ${PRIORITY_LABEL_COLOR[r.priority]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-[9px] font-bold uppercase tracking-wide ${PRIORITY_LABEL_COLOR[r.priority]}`}>
              {r.priority}
            </span>
            <span className="text-[10px] text-slate-400 ml-2">{INTEGRITY_CATEGORY_LABELS[r.category]}</span>
            <p className="text-xs text-slate-700 font-medium mt-0.5">{r.action}</p>
            {r.detail && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{r.detail}</p>}
          </div>
          {action && actionLabel && (
            <button
              onClick={action}
              disabled={isPending}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isPending ? <Loader2 size={9} className="animate-spin" /> : actionIcon}
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onRun, isRunning }: { onRun: () => void; isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <ShieldCheck size={28} className="text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-1">No integrity report yet</p>
      <p className="text-xs text-slate-400 mb-6 max-w-xs">
        Run an integrity check to validate all 9 quality categories for this tutorial draft.
      </p>
      <button
        onClick={onRun}
        disabled={isRunning}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors"
      >
        {isRunning ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
        Run Integrity Check
      </button>
    </div>
  );
}

// ─── IntegrityTab ─────────────────────────────────────────────────────────────

interface IntegrityTabProps {
  draftId: string;
  organizationId?: string;
}

export function IntegrityTab({ draftId, organizationId }: IntegrityTabProps) {
  const [now] = useState(() => Date.now());
  const { data: report, isLoading } = useDocStudioIntegrityReport(draftId);
  const runCheck = useRunIntegrityCheck();
  const markValidated = useMarkDraftValidated();
  const requestRecapture = useRequestRecapture();
  const resolveDrift = useResolveDrift();
  const regenerateContent = useRegenerateContent();
  const startRenderJob = useStartRenderJob();
  const { showToast } = useToast();

  const isRunning = runCheck.isPending;
  const isRendering = startRenderJob.isPending;
  const isRegenerating = regenerateContent.isPending;

  function handleRun() {
    runCheck.mutate(
      { draft_id: draftId },
      {
        onSuccess: () => showToast('Integrity check complete', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      },
    );
  }

  function handleMarkValidated() {
    markValidated.mutate(
      { draft_id: draftId },
      {
        onSuccess: () => showToast('Draft marked as validated', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      },
    );
  }

  function handleRequestRecapture() {
    requestRecapture.mutate(
      { draft_id: draftId, reason: 'Manually requested via Integrity tab' },
      {
        onSuccess: () => showToast('Recapture requested', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      },
    );
  }

  function handleResolveDrift() {
    resolveDrift.mutate(
      { draft_id: draftId },
      {
        onSuccess: () => showToast('Drift resolved', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      },
    );
  }

  function handleRerender() {
    if (!organizationId) {
      showToast('Organization context required to start a render job', 'error');
      return;
    }
    startRenderJob.mutate(
      { draftId, organizationId, engineProvider: 'mock', renderMode: 'standard_training' },
      {
        onSuccess: () => showToast('Render job queued', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      },
    );
  }

  function handleRegenerateContent() {
    regenerateContent.mutate(
      { draft_id: draftId },
      {
        onSuccess: () => showToast('Content regeneration requested', 'success'),
        onError: (e) => showToast(e.message, 'error'),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!report) {
    return <EmptyState onRun={handleRun} isRunning={isRunning} />;
  }

  const status = report.overall_status as IntegrityStatus;
  const gaugeColor = STATUS_GAUGE_COLOR[status];
  const statusCfg = INTEGRITY_STATUS_COLORS[status];
  const warnings = report.warnings_json ?? [];
  const failures = report.failures_json ?? [];
  const recommendations = report.recommendations_json ?? [];
  const isHealthy = status === 'healthy';
  const hasDrift = status === 'outdated' || status === 'needs_recapture' ||
    (report.drift_integrity_score !== null && report.drift_integrity_score < 60);

  const sortedRecs = [...recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order];
  });

  return (
    <div className="p-5 space-y-5">

      {/* ── Overview header ── */}
      <div className="flex items-start gap-5">
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <DonutGauge score={report.overall_score} color={gaugeColor} size={112} />
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg}`}>
            {status === 'healthy' ? <ShieldCheck size={12} /> : status.startsWith('needs') ? <ShieldX size={12} /> : <ShieldAlert size={12} />}
            {INTEGRITY_STATUS_LABELS[status]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <GitBranch size={12} className="text-slate-400" />
              <span className="text-xs text-slate-500">
                Last checked {relativeTime(report.last_checked_at, now)}
                {report.check_duration_ms != null && (
                  <span className="ml-1.5 text-slate-400">· {report.check_duration_ms}ms</span>
                )}
              </span>
            </div>
          </div>

          <ValidationHistory draftId={draftId} />

          {/* Issue summary strip */}
          {(failures.length > 0 || warnings.length > 0) && (
            <div className="flex items-center gap-3 mt-3 text-xs">
              {failures.length > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle size={12} /> {failures.length} failure{failures.length !== 1 ? 's' : ''}
                  {failures.filter(f => f.blocking).length > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded font-medium ml-1">
                      {failures.filter(f => f.blocking).length} blocking
                    </span>
                  )}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle size={12} /> {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                </span>
              )}
              {recommendations.length > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Info size={12} /> {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-2 py-3 border-y border-slate-100">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          {isRunning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {isRunning ? 'Running…' : 'Re-run Check'}
        </button>

        {!isHealthy && (
          <button
            onClick={handleMarkValidated}
            disabled={markValidated.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {markValidated.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Mark Validated
          </button>
        )}

        <button
          onClick={handleRerender}
          disabled={isRendering}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isRendering ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {isRendering ? 'Queueing…' : 'Re-render'}
        </button>

        <button
          onClick={handleRegenerateContent}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {isRegenerating ? 'Requesting…' : 'Regenerate Content'}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {hasDrift && (
            <button
              onClick={handleResolveDrift}
              disabled={resolveDrift.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {resolveDrift.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Resolve Drift
            </button>
          )}
          <button
            onClick={handleRequestRecapture}
            disabled={requestRecapture.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {requestRecapture.isPending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            Request Recapture
          </button>
        </div>
      </div>

      {/* ── Drift status panel ── */}
      {hasDrift && (
        <DriftStatusPanel
          report={report}
          onResolveDrift={handleResolveDrift}
          onRequestRecapture={handleRequestRecapture}
          resolvePending={resolveDrift.isPending}
          recapturePending={requestRecapture.isPending}
        />
      )}

      {/* ── Category scorecards ── */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs font-semibold text-slate-600">Category Breakdown</span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
            {INTEGRITY_CATEGORIES.filter(c => {
              const s = report[CATEGORY_SCORE_KEY[c]] as number | null;
              return s !== null && s >= 90;
            }).length}/{INTEGRITY_CATEGORIES.length} passing
          </span>
        </div>
        <div className="space-y-1.5">
          {INTEGRITY_CATEGORIES.map((cat) => {
            const catScore = report[CATEGORY_SCORE_KEY[cat]] as number | null;
            const catWarnings = warnings.filter(w => w.category === cat);
            const catFailures = failures.filter(f => f.category === cat);
            const catRecs = recommendations.filter(r => r.category === cat);

            let actionLabel: string | undefined;
            let actionIcon: React.ReactElement | undefined;
            let onAction: (() => void) | undefined;
            let actionPending = false;

            if (cat === 'capture' || cat === 'screenshot') {
              actionLabel = 'Request Recapture';
              actionIcon = <Camera size={10} />;
              onAction = handleRequestRecapture;
              actionPending = requestRecapture.isPending;
            } else if (cat === 'render') {
              actionLabel = 'Re-render';
              actionIcon = <Zap size={10} />;
              onAction = handleRerender;
              actionPending = isRendering;
            } else if (cat === 'content' || cat === 'narration') {
              actionLabel = 'Regenerate';
              actionIcon = <Sparkles size={10} />;
              onAction = handleRegenerateContent;
              actionPending = isRegenerating;
            } else if (cat === 'drift') {
              actionLabel = 'Resolve Drift';
              actionIcon = <RotateCcw size={10} />;
              onAction = handleResolveDrift;
              actionPending = resolveDrift.isPending;
            }

            const hasIssues = catFailures.length > 0 || catWarnings.length > 0;

            return (
              <CategoryScorecard
                key={cat}
                category={cat}
                score={catScore}
                warnings={catWarnings}
                failures={catFailures}
                recommendations={catRecs}
                actionLabel={hasIssues ? actionLabel : undefined}
                actionIcon={actionIcon}
                onAction={hasIssues ? onAction : undefined}
                actionPending={actionPending}
              />
            );
          })}
        </div>
      </div>

      {/* ── Recommendations ── */}
      {sortedRecs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Info size={13} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Recommendations</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {sortedRecs.filter(r => r.priority === 'high').length} high ·{' '}
              {sortedRecs.filter(r => r.priority === 'medium').length} med ·{' '}
              {sortedRecs.filter(r => r.priority === 'low').length} low
            </span>
          </div>
          <div className="space-y-2">
            {sortedRecs.map((r, i) => (
              <RecommendationCard
                key={i}
                r={r}
                onRerun={handleRun}
                onRecapture={handleRequestRecapture}
                onRerender={handleRerender}
                onRegen={handleRegenerateContent}
                isRunning={isRunning}
                isCapturing={requestRecapture.isPending}
                isRendering={isRendering}
                isRegenerating={isRegenerating}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── All healthy ── */}
      {failures.length === 0 && warnings.length === 0 && recommendations.length === 0 && isHealthy && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
          <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          All 9 integrity checks passed with no issues detected.
        </div>
      )}

      {/* ── Engine version ── */}
      <p className="text-[10px] text-slate-300 text-right">engine v{report.engine_version}</p>
    </div>
  );
}

import { RefreshCw, Loader as Loader2, Star, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Info, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useQualityScore,
  useQualityHistory,
  useCalculateQuality,
} from '../../../hooks/useDocStudioQuality';
import { useToast } from '../../../lib/toast';
import type { QualityTier, QualityWarning } from '../../../types/documentation';

const TIER_CONFIG: Record<QualityTier, { label: string; color: string; ring: string; gaugeColor: string; bg: string; border: string }> = {
  excellent: { label: 'Excellent', color: 'text-green-700', ring: 'ring-green-300', gaugeColor: '#16a34a', bg: 'bg-green-50', border: 'border-green-200' },
  good: { label: 'Good', color: 'text-blue-700', ring: 'ring-blue-300', gaugeColor: '#2563eb', bg: 'bg-blue-50', border: 'border-blue-200' },
  needs_review: { label: 'Needs Review', color: 'text-amber-700', ring: 'ring-amber-300', gaugeColor: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200' },
  needs_recapture: { label: 'Needs Recapture', color: 'text-orange-700', ring: 'ring-orange-300', gaugeColor: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200' },
  outdated: { label: 'Outdated', color: 'text-red-700', ring: 'ring-red-300', gaugeColor: '#dc2626', bg: 'bg-red-50', border: 'border-red-200' },
  incomplete: { label: 'Incomplete', color: 'text-slate-700', ring: 'ring-slate-300', gaugeColor: '#94a3b8', bg: 'bg-slate-50', border: 'border-slate-200' },
};

const WARNING_ICONS = {
  info: <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />,
  critical: <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />,
};

const WARNING_FIX_TAB: Record<string, string> = {
  drift: 'drift',
  screenshot: 'drift',
  narration: 'narration',
  audio: 'assembly',
  transcript: 'transcript',
  scene: 'scenes',
  assembly: 'assembly',
  captions: 'captions',
  caption: 'captions',
  package: 'package_manifest',
};

interface DonutGaugeProps {
  score: number;
  color: string;
  size?: number;
}

function DonutGauge({ score, color, size = 120 }: DonutGaugeProps) {
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
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={10}
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(${rotateAngle} ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeDasharray={`${arcLength - offset} ${circumference - (arcLength - offset)}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(${rotateAngle} ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" className="font-bold" fill="#1e293b" fontSize={24} fontWeight={700}>
        {score}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        / 100
      </text>
    </svg>
  );
}

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-medium text-slate-700">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface WarningItemProps {
  w: QualityWarning;
  onNavigateToTab?: (tab: string) => void;
}

function WarningItem({ w, onNavigateToTab }: WarningItemProps) {
  const fixTab = w.field ? WARNING_FIX_TAB[w.field.toLowerCase()] : undefined;
  return (
    <div className="flex gap-2 py-2 group">
      {WARNING_ICONS[w.severity]}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700 leading-snug">{w.message}</p>
        {w.field && <p className="text-xs text-slate-400 mt-0.5">{w.field}</p>}
      </div>
      {fixTab && onNavigateToTab && (
        <button
          onClick={() => onNavigateToTab(fixTab)}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Fix <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

interface Props {
  draftId: string;
  onNavigateToTab?: (tab: string) => void;
}

export function QualityTab({ draftId, onNavigateToTab }: Props) {
  const { showToast } = useToast();
  const { data: score, isLoading } = useQualityScore(draftId);
  const { data: history = [] } = useQualityHistory(draftId, 8);
  const calculate = useCalculateQuality();

  const handleCalculate = async () => {
    try {
      await calculate.mutateAsync(draftId);
      showToast('Quality score updated', 'success');
    } catch {
      showToast('Failed to calculate quality', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  if (!score) {
    return (
      <div className="space-y-3">
        <div className="text-center py-12 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-xl">
          No quality score yet.
          <button
            onClick={handleCalculate}
            disabled={calculate.isPending}
            className="ml-2 text-blue-600 hover:underline disabled:opacity-50"
          >
            {calculate.isPending ? 'Calculating…' : 'Calculate now'}
          </button>
        </div>
      </div>
    );
  }

  const tier = TIER_CONFIG[score.quality_tier as QualityTier] ?? TIER_CONFIG.incomplete;
  const warnings = score.warnings_json ?? [];
  const criticalCount = warnings.filter((w) => w.severity === 'critical').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;

  const chartData = history.map((h, i) => ({
    label: `#${history.length - i}`,
    score: h.overall_score,
  })).reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-amber-500" />
          <span className="text-sm font-medium text-slate-700">Quality Score</span>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {calculate.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Recalculate
        </button>
      </div>

      <div className={`bg-white border rounded-xl p-5 ${tier.border}`}>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <DonutGauge score={score.overall_score} color={tier.gaugeColor} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tier.bg} ${tier.color} mb-2`}>
              <CheckCircle size={11} />
              {tier.label}
            </span>
            <div className="flex items-center gap-3 text-xs mt-1">
              {criticalCount > 0 && (
                <span className="text-red-600 font-medium">{criticalCount} critical</span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-600 font-medium">{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
              )}
              {criticalCount === 0 && warnCount === 0 && warnings.length === 0 && (
                <span className="text-green-600 flex items-center gap-1"><CheckCircle size={11} />No issues</span>
              )}
            </div>
            {score.recommendation && (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-3">{score.recommendation}</p>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <ScoreBar label="Completion" score={score.completion_score} />
          <ScoreBar label="Screenshots" score={score.screenshot_score} />
          <ScoreBar label="Narration" score={score.narration_score} />
          <ScoreBar label="Transcript" score={score.transcript_score} />
          <ScoreBar label="Structure" score={score.structure_score} />
          <ScoreBar label="Drift" score={score.drift_score} />
          <div className="pt-1 pb-0.5 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Pipeline</span>
          </div>
          <ScoreBar label="Audio Assembly" score={score.assembly_score} />
          <ScoreBar label="Caption Coverage" score={score.caption_score} />
          <ScoreBar label="Timing Manifest" score={score.timing_score} />
          <ScoreBar label="Export Readiness" score={score.export_readiness_score} />
          <ScoreBar label="Render Readiness" score={score.render_readiness_score ?? 0} />
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Warnings ({warnings.length})</p>
          {onNavigateToTab && (
            <p className="text-[11px] text-slate-400 mb-2">Hover a warning for a quick fix link</p>
          )}
          <div className="divide-y divide-slate-100">
            {warnings.map((w, i) => (
              <WarningItem key={i} w={w} onNavigateToTab={onNavigateToTab} />
            ))}
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score Trend</p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}
                labelStyle={{ color: '#64748b' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#0d9488"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0d9488' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {history.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score History</p>
          <div className="space-y-1">
            {history.map((h, i) => {
              const hTier = TIER_CONFIG[h.quality_tier as QualityTier] ?? TIER_CONFIG.incomplete;
              return (
                <div key={h.id} className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400 w-4 text-right">{i + 1}</span>
                  <span className="font-medium text-slate-700 w-8">{h.overall_score}</span>
                  <span className={`px-1.5 py-0.5 rounded-full ${hTier.bg} ${hTier.color}`}>{hTier.label}</span>
                  <span className="text-slate-400 ml-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

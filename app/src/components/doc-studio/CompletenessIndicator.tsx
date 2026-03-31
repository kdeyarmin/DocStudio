import { CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
import type { DocStudioDraft } from '../../types/doc-studio';
import { computeChecklistFromDraft, computeScore } from './completeness-utils';

interface Props {
  draft: Partial<DocStudioDraft>;
  compact?: boolean;
}

export function CompletenessIndicator({ draft, compact = false }: Props) {
  const checklist = computeChecklistFromDraft(draft);
  const score = computeScore(checklist);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle
              cx="36" cy="36" r={radius} fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-slate-800">{score}</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Completeness</p>
          <p className="text-xs text-slate-500">{checklist.filter(c => c.passed).length}/{checklist.length} items passed</p>
        </div>
      </div>

      {!compact && (
        <div className="space-y-1.5">
          {checklist.map(item => (
            <div key={item.key} className="flex items-center gap-2">
              {item.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              }
              <span className={`text-xs ${item.passed ? 'text-slate-600' : 'text-slate-400'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

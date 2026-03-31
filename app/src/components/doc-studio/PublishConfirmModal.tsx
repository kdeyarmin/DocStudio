import { useState } from 'react';
import { X, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Send } from 'lucide-react';
import { computeChecklistFromDraft, computeScore } from './completeness-utils';
import type { DocStudioDraft } from '../../types/doc-studio';

interface Props {
  draft: DocStudioDraft;
  onConfirm: (publishNotes: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function PublishConfirmModal({ draft, onConfirm, onClose, isLoading }: Props) {
  const [notes, setNotes] = useState(draft.publish_notes ?? '');

  const checklist = computeChecklistFromDraft(draft);
  const score = computeScore(checklist);
  const canPublish = score >= 40;

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Publish Draft</h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
                <circle cx="40" cy="40" r={radius} fill="none"
                  stroke={color} strokeWidth="7"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-800">{score}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Completeness Score</p>
              <p className="text-xs text-slate-500 mb-2">
                {checklist.filter(c => c.passed).length} of {checklist.length} items complete
              </p>
              {!canPublish && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Minimum score of 40 required to publish
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                {item.passed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <span className={`text-xs ${item.passed ? 'text-slate-600' : 'text-red-600 font-medium'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Publish Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What changed in this version?"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={!canPublish || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

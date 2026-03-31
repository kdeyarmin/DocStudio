import { useState, useEffect } from 'react';
import { X, CircleCheck as CheckCircle2, Circle as XCircle, CircleAlert as AlertCircle, ChevronDown, Package } from 'lucide-react';
import { computeChecklistFromDraft } from './completeness-utils';
import { buildPackageReadinessChecklist } from '../../services/documentation/packages/exportService';
import type { DocStudioDraft, ReviewDecision } from '../../types/doc-studio';
import type { TutorialPackageManifest } from '../../types/documentation';

interface Props {
  draft: DocStudioDraft;
  onConfirm: (decision: ReviewDecision, notes: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  packageManifest?: TutorialPackageManifest | null;
}

const DECISIONS: Array<{
  value: ReviewDecision;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    value: 'approved',
    label: 'Approve',
    desc: 'Content is ready to publish',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
  },
  {
    value: 'changes_requested',
    label: 'Request Changes',
    desc: 'Needs revisions before publishing',
    icon: AlertCircle,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  {
    value: 'rejected',
    label: 'Reject',
    desc: 'Content should be discarded',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
];

export function ReviewSubmitModal({ draft, onConfirm, onClose, isLoading, packageManifest }: Props) {
  const [decision, setDecision] = useState<ReviewDecision>('approved');
  const [notes, setNotes] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAssembly, setShowAssembly] = useState(false);

  const checklist = computeChecklistFromDraft(draft);
  const passed = checklist.filter(c => c.passed).length;
  const total = checklist.length;

  const assemblyChecklist = packageManifest ? buildPackageReadinessChecklist(packageManifest) : null;
  const assemblyPassed = assemblyChecklist?.filter(c => c.passed).length ?? 0;
  const assemblyTotal = assemblyChecklist?.length ?? 0;
  const assemblyAllPassed = assemblyPassed === assemblyTotal && assemblyTotal > 0;

  const selected = DECISIONS.find(d => d.value === decision) ?? DECISIONS[0];

  // Keyboard shortcuts: 1/2/3 for decisions, Ctrl+Enter to submit, Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isLoading) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (decision !== 'changes_requested' || notes.trim()) {
            onConfirm(decision, notes);
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 3) {
        e.preventDefault();
        setDecision(DECISIONS[num - 1].value);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (decision !== 'changes_requested' || notes.trim()) {
          onConfirm(decision, notes);
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, decision, notes, onConfirm, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Submit Review</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Your Decision</p>
            <div className="space-y-2">
              {DECISIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    decision === opt.value
                      ? `${opt.bg} ${opt.border}`
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={opt.value}
                    checked={decision === opt.value}
                    onChange={() => setDecision(opt.value)}
                    className="accent-blue-600"
                  />
                  <opt.icon className={`w-4 h-4 flex-shrink-0 ${decision === opt.value ? opt.color : 'text-slate-400'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${decision === opt.value ? opt.color : 'text-slate-700'}`}>{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                  <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${decision === opt.value ? 'bg-white/50 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>{DECISIONS.indexOf(opt) + 1}</kbd>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowChecklist(s => !s)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showChecklist ? 'rotate-180' : ''}`} />
            Completeness Checklist ({passed}/{total})
          </button>

          {showChecklist && (
            <div className="space-y-1.5 pl-2">
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

          {assemblyChecklist && (
            <>
              <button
                onClick={() => setShowAssembly(s => !s)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAssembly ? 'rotate-180' : ''}`} />
                <Package className="w-3 h-3" />
                Assembly Readiness ({assemblyPassed}/{assemblyTotal})
                {!assemblyAllPassed && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                    Incomplete
                  </span>
                )}
                {assemblyAllPassed && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                    Ready
                  </span>
                )}
              </button>

              {showAssembly && (
                <div className="space-y-1.5 pl-2">
                  {assemblyChecklist.map(item => (
                    <div key={item.label} className="flex items-start gap-2">
                      {item.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      }
                      <div>
                        <span className={`text-xs ${item.passed ? 'text-slate-600' : 'text-slate-500'}`}>{item.label}</span>
                        <span className="text-xs text-slate-400 ml-1.5">— {item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Review Notes
              {decision === 'changes_requested' && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={decision === 'changes_requested' ? 'Describe what needs to be changed…' : 'Optional feedback…'}
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
            onClick={() => onConfirm(decision, notes)}
            disabled={(decision === 'changes_requested' && !notes.trim()) || isLoading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${selected.bg.replace('bg-', 'bg-').replace('50', '600 hover:bg-').replace('600', '600')} ${
              decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' :
              decision === 'changes_requested' ? 'bg-amber-600 hover:bg-amber-700' :
              'bg-red-600 hover:bg-red-700'
            }`}
          >
            <selected.icon className="w-4 h-4" />
            {isLoading ? 'Submitting…' : `Submit ${selected.label}`}
            <kbd className="text-[10px] font-mono opacity-60 ml-1">⌘↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

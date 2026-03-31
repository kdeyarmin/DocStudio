import { useState } from 'react';
import { X, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Loader as Loader2, ThumbsUp, Sparkles, ArrowRight } from 'lucide-react';
import { useApproveReview, useReviewWorkflow } from '../../../hooks/useDocStudioReview';
import { useLatestAIReviewRun } from '../../../hooks/useDocStudioAIReview';
import { useToast } from '../../../lib/toast';

const STALE_HOURS = 24;

interface Props {
  draftId: string;
  organizationId: string;
  onClose: () => void;
  onNavigateToAIInsights?: () => void;
}

export function ApprovalModal({ draftId, organizationId, onClose, onNavigateToAIInsights }: Props) {
  const { showToast } = useToast();
  const approve = useApproveReview();
  const { data: workflow } = useReviewWorkflow(draftId);
  const { data: latestRun } = useLatestAIReviewRun(draftId, 'approval_readiness');

  const [notes, setNotes] = useState('');
  const [now] = useState(() => Date.now());

  const isRunStale = latestRun
    ? (now - new Date(latestRun.created_at).getTime()) > STALE_HOURS * 60 * 60 * 1000
    : false;

  const runPasses = latestRun && ['pass', 'pass_with_notes'].includes(latestRun.verdict);

  const aiGateBlocked = !!(
    workflow?.ai_review_required &&
    (!latestRun || !runPasses || isRunStale)
  );

  const handleApprove = async () => {
    try {
      await approve.mutateAsync({ draft_id: draftId, organization_id: organizationId, approval_notes: notes || undefined });
      showToast('Tutorial approved successfully', 'success');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Approval failed';
      showToast(msg, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">Approve Tutorial</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {aiGateBlocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">AI Review Required</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {!latestRun
                      ? 'No AI review has been run for this tutorial. Run an AI review and ensure it passes before approving.'
                      : isRunStale
                        ? `The latest AI review is over ${STALE_HOURS} hours old. Run a fresh review before approving.`
                        : `The latest AI review verdict is "${latestRun.verdict.replace(/_/g, ' ')}". A passing verdict is required before approving.`
                    }
                  </p>
                </div>
              </div>
              {onNavigateToAIInsights && (
                <button
                  onClick={() => { onClose(); onNavigateToAIInsights(); }}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 transition-colors pl-6"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Go to AI Insights
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-800">
                Approving will mark this tutorial as ready for rendering and lock further content edits.
              </p>
            </div>
          )}

          {!aiGateBlocked && latestRun && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-slate-700">AI Review Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{latestRun.overall_score}/100</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  latestRun.verdict === 'pass'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-blue-100 text-blue-700 border-blue-200'
                }`}>
                  {latestRun.verdict === 'pass' ? 'Pass' : 'Pass w/ Notes'}
                </span>
              </div>
            </div>
          )}

          {workflow?.reviewer_notes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-800 mb-0.5">Reviewer Notes</p>
                <p className="text-xs text-amber-700">{workflow.reviewer_notes}</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Approval Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes for the record..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={approve.isPending || aiGateBlocked}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approve.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

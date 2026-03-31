import { useState } from 'react';
import { User, Calendar, ArrowRight, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Play, Loader as Loader2, Sparkles, TriangleAlert as AlertTriangle, Clock } from 'lucide-react';
import {
  useReviewWorkflow,
  useStartReview,
  useAdvanceReviewStage,
  useUpdateReviewTask,
  useReviewTasks,
} from '../../../hooks/useDocStudioReview';
import { useLatestAIReviewRun, useSetAIReviewRequired } from '../../../hooks/useDocStudioAIReview';
import { ReviewPipelineBar } from './ReviewPipelineBar';
import { ReviewStageBadge } from './ReviewStageBadge';
import { AssignReviewerModal } from './AssignReviewerModal';
import { ApprovalModal } from './ApprovalModal';
import { RequestChangesModal } from './RequestChangesModal';
import type { AIReviewVerdict, ReviewWorkflowStage } from '../../../types/doc-studio-review';
import { useToast } from '../../../lib/toast';

const STALE_HOURS = 24;

interface Props {
  draftId: string;
  organizationId: string;
  onNavigateToAIInsights?: () => void;
}

const ADVANCE_LABEL: Partial<Record<ReviewWorkflowStage, string>> = {
  automated_checks: 'Advance to Awaiting Review',
  awaiting_review:  'Start Review',
  review_in_progress: 'Mark Ready for Approval',
  ready_for_approval: 'Approve',
  approved: 'Mark Ready for Render',
  ready_for_render: 'Mark Rendered',
};

const VERDICT_CONFIG: Record<AIReviewVerdict, { label: string; classes: string }> = {
  pass:            { label: 'Pass',          classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pass_with_notes: { label: 'Pass w/ Notes', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  needs_work:      { label: 'Needs Work',    classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  fail:            { label: 'Blocked',       classes: 'bg-red-100 text-red-700 border-red-200' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(iso: string, referenceMs: number) {
  const diffMs = referenceMs - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ReviewOverviewPanel({ draftId, organizationId, onNavigateToAIInsights }: Props) {
  const { showToast } = useToast();
  const { data: workflow, isLoading } = useReviewWorkflow(draftId);
  const { data: tasks = [] } = useReviewTasks(draftId);
  const { data: latestRun } = useLatestAIReviewRun(draftId, 'approval_readiness');
  const startReview = useStartReview();
  const advanceStage = useAdvanceReviewStage();
  const updateTask = useUpdateReviewTask();
  const setAIRequired = useSetAIReviewRequired();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [now] = useState(() => Date.now());

  const stage = workflow?.workflow_stage ?? 'draft';
  const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const isRunStale = latestRun
    ? (now - new Date(latestRun.created_at).getTime()) > STALE_HOURS * 60 * 60 * 1000
    : false;

  const handleStartReview = async () => {
    try {
      await startReview.mutateAsync(draftId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to start review', 'error');
    }
  };

  const handleAdvance = async () => {
    if (stage === 'awaiting_review') { handleStartReview(); return; }
    if (stage === 'ready_for_approval') { setShowApproveModal(true); return; }
    try {
      await advanceStage.mutateAsync({ draft_id: draftId, organization_id: organizationId });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to advance stage', 'error');
    }
  };

  const handleToggleAIRequired = async () => {
    if (!workflow) return;
    try {
      await setAIRequired.mutateAsync({
        draftId,
        organizationId,
        required: !workflow.ai_review_required,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update AI review requirement', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-16 bg-slate-200 rounded" />
      </div>
    );
  }

  const advanceLabel = ADVANCE_LABEL[stage as ReviewWorkflowStage];
  const isPending = startReview.isPending || advanceStage.isPending;

  return (
    <div className="space-y-5">
      <ReviewPipelineBar currentStage={stage as ReviewWorkflowStage} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Stage</span>
            <ReviewStageBadge stage={stage as ReviewWorkflowStage} />
          </div>
          {workflow?.assigned_reviewer_id ? (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <User className="w-4 h-4 text-slate-400" />
              <span className="truncate font-mono text-xs">{workflow.assigned_reviewer_id.slice(0, 8)}…</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No reviewer assigned</p>
          )}
          {workflow?.approved_at && (
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" />
              Approved {formatDate(workflow.approved_at)}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">Tasks</span>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="w-4 h-4" />
              <span>{openTasks.length} open</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              <span>{completedTasks.length} done</span>
            </div>
          </div>
          {tasks.slice(0, 3).map(task => (
            <div key={task.id} className="flex items-center gap-2">
              <button
                onClick={() => updateTask.mutateAsync({ task_id: task.id, draft_id: draftId, status: task.status === 'completed' ? 'pending' : 'completed' })}
                className="shrink-0"
              >
                {task.status === 'completed'
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                }
              </button>
              <span className={`text-xs ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {task.task_type.replace(/_/g, ' ')}
              </span>
              {task.due_date && (
                <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.due_date)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">AI Review</span>
          </div>
          {workflow && (
            <button
              onClick={handleToggleAIRequired}
              disabled={setAIRequired.isPending}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                workflow.ai_review_required
                  ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {setAIRequired.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <span className={`w-2 h-2 rounded-full ${workflow.ai_review_required ? 'bg-blue-500' : 'bg-slate-400'}`} />
              }
              {workflow.ai_review_required ? 'Required' : 'Optional'}
            </button>
          )}
        </div>

        {latestRun ? (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-800">{latestRun.overall_score}</span>
                <span className="text-xs text-slate-400">/100</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${VERDICT_CONFIG[latestRun.verdict as AIReviewVerdict].classes}`}>
                  {VERDICT_CONFIG[latestRun.verdict as AIReviewVerdict].label}
                </span>
                {isRunStale && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" />
                    Stale
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="text-red-600 font-medium">{latestRun.hard_blocker_count} hard</span>
                <span className="text-amber-600 font-medium">{latestRun.soft_blocker_count} soft</span>
                <span>{formatRelative(latestRun.created_at, now)}</span>
              </div>
            </div>
            {onNavigateToAIInsights && (
              <button
                onClick={onNavigateToAIInsights}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                View details
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              No AI review run yet
            </div>
            {onNavigateToAIInsights && (
              <button
                onClick={onNavigateToAIInsights}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Run AI review
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {workflow?.reviewer_notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800 mb-1">Reviewer Notes</p>
          <p className="text-sm text-amber-700">{workflow.reviewer_notes}</p>
        </div>
      )}

      {workflow?.approval_notes && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-800 mb-1">Approval Notes</p>
          <p className="text-sm text-emerald-700">{workflow.approval_notes}</p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
        >
          <User className="w-4 h-4" />
          {workflow?.assigned_reviewer_id ? 'Reassign' : 'Assign Reviewer'}
        </button>

        {['review_in_progress', 'changes_requested'].includes(stage) && (
          <button
            onClick={() => setShowChangesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-medium transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            Request Changes
          </button>
        )}

        {advanceLabel && (
          <button
            onClick={handleAdvance}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ml-auto"
          >
            {isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : stage === 'awaiting_review'
                ? <Play className="w-4 h-4" />
                : <ArrowRight className="w-4 h-4" />
            }
            {advanceLabel}
          </button>
        )}
      </div>

      {showAssignModal && (
        <AssignReviewerModal
          draftId={draftId}
          organizationId={organizationId}
          onClose={() => setShowAssignModal(false)}
        />
      )}
      {showApproveModal && (
        <ApprovalModal
          draftId={draftId}
          organizationId={organizationId}
          onClose={() => setShowApproveModal(false)}
          onNavigateToAIInsights={onNavigateToAIInsights}
        />
      )}
      {showChangesModal && (
        <RequestChangesModal
          draftId={draftId}
          organizationId={organizationId}
          onClose={() => setShowChangesModal(false)}
        />
      )}
    </div>
  );
}

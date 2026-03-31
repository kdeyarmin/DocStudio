import { useState } from 'react';
import { GitPullRequestArrow, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ArrowRight, ChartBar as BarChart3, Users } from 'lucide-react';
import { useReviewDashboard } from '../../hooks/useDocStudioReview';
import { ReviewStageBadge } from './review/ReviewStageBadge';
import type { ReviewWorkflowStage } from '../../types/doc-studio-review';

interface Props {
  organizationId: string;
  onNavigateToDraft: (id: string) => void;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${color}`}>
      <div className="rounded-lg p-2 bg-white/60">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none mb-0.5">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ReviewDashboardPage({ organizationId, onNavigateToDraft }: Props) {
  const { data, isLoading } = useReviewDashboard(organizationId);
  const [filterStage, setFilterStage] = useState<ReviewWorkflowStage | 'all'>('all');

  const workflows = data?.workflows ?? [];

  const stats = {
    total:       workflows.length,
    awaiting:    workflows.filter(w => w.workflow_stage === 'awaiting_review').length,
    inProgress:  workflows.filter(w => w.workflow_stage === 'review_in_progress').length,
    needsChange: workflows.filter(w => w.workflow_stage === 'changes_requested').length,
    approved:    workflows.filter(w => w.workflow_stage === 'approved').length,
  };

  const filtered = filterStage === 'all'
    ? workflows
    : workflows.filter(w => w.workflow_stage === filterStage);

  const FILTER_OPTIONS: Array<{ value: ReviewWorkflowStage | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'awaiting_review', label: 'Awaiting Review' },
    { value: 'review_in_progress', label: 'In Progress' },
    { value: 'changes_requested', label: 'Changes Requested' },
    { value: 'ready_for_approval', label: 'Ready for Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'ready_for_render', label: 'Ready for Render' },
    { value: 'rendered', label: 'Rendered' },
  ];

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 p-4 animate-pulse h-20" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 p-4 animate-pulse h-48" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitPullRequestArrow className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Review Queue</h1>
            <p className="text-sm text-slate-500">Human-in-the-loop approval workflow for tutorials</p>
          </div>
        </div>
        {Object.keys(data?.reviewer_workload ?? {}).length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs">
            <Users className="w-3.5 h-3.5" />
            {Object.keys(data?.reviewer_workload ?? {}).length} reviewer(s) active
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Drafts" value={stats.total} icon={BarChart3} color="border-slate-200 text-slate-700" />
        <StatCard label="Awaiting Review" value={stats.awaiting} icon={Clock} color="border-amber-200 bg-amber-50 text-amber-800" />
        <StatCard label="In Progress" value={stats.inProgress} icon={GitPullRequestArrow} color="border-blue-200 bg-blue-50 text-blue-800" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle} color="border-emerald-200 bg-emerald-50 text-emerald-800" />
      </div>

      {stats.needsChange > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            {stats.needsChange} tutorial{stats.needsChange !== 1 ? 's' : ''} need{stats.needsChange === 1 ? 's' : ''} change review
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStage(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStage === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitPullRequestArrow className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No tutorials in this stage</p>
            <p className="text-xs text-slate-400 mt-1">Open a draft and start the review workflow from the Review tab</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(workflow => (
              <div
                key={workflow.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer group transition-colors"
                onClick={() => onNavigateToDraft(workflow.draft_id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {workflow.draft?.title ?? 'Untitled Draft'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Updated {formatDate(workflow.updated_at)}
                    {workflow.assigned_reviewer_id && (
                      <span className="ml-2 font-mono">{workflow.assigned_reviewer_id.slice(0, 8)}…</span>
                    )}
                  </p>
                </div>
                <ReviewStageBadge stage={workflow.workflow_stage as ReviewWorkflowStage} size="sm" />
                {workflow.draft?.integrity_score != null && (
                  <span className={`text-xs font-medium tabular-nums ${workflow.draft.integrity_score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {workflow.draft.integrity_score}%
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Clock, User, CircleCheck as CheckCircle, CircleAlert as AlertCircle, MessageSquare, ArrowRight, History } from 'lucide-react';
import { useReviewHistory } from '../../../hooks/useDocStudioReview';
import type { ReviewHistoryAction } from '../../../types/doc-studio-review';

interface Props {
  draftId: string;
}

const ACTION_CONFIG: Record<ReviewHistoryAction, { label: string; icon: React.ElementType; color: string }> = {
  reviewer_assigned:  { label: 'Reviewer assigned',   icon: User,          color: 'text-blue-600 bg-blue-50 border-blue-200' },
  review_started:     { label: 'Review started',      icon: Clock,         color: 'text-amber-600 bg-amber-50 border-amber-200' },
  comment_added:      { label: 'Comment added',        icon: MessageSquare, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  change_requested:   { label: 'Changes requested',   icon: AlertCircle,   color: 'text-rose-600 bg-rose-50 border-rose-200' },
  change_resolved:    { label: 'Change resolved',     icon: CheckCircle,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  tutorial_approved:  { label: 'Tutorial approved',   icon: CheckCircle,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  tutorial_rejected:  { label: 'Tutorial rejected',   icon: AlertCircle,   color: 'text-rose-600 bg-rose-50 border-rose-200' },
  stage_advanced:     { label: 'Stage advanced',      icon: ArrowRight,    color: 'text-blue-600 bg-blue-50 border-blue-200' },
  checklist_updated:  { label: 'Checklist updated',   icon: CheckCircle,   color: 'text-sky-600 bg-sky-50 border-sky-200' },
  ai_review_run:      { label: 'AI review run',       icon: History,       color: 'text-purple-600 bg-purple-50 border-purple-200' },
  suggestion_actioned: { label: 'Suggestion actioned', icon: CheckCircle,   color: 'text-teal-600 bg-teal-50 border-teal-200' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ReviewHistoryTimeline({ draftId }: Props) {
  const { data: entries = [], isLoading } = useReviewHistory(draftId, 50);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="h-3.5 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <History className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No history yet</p>
        <p className="text-xs text-slate-400 mt-0.5">Actions taken on this tutorial will appear here</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-4 bottom-4 w-px bg-slate-200" />
      <div className="space-y-4">
        {entries.map((entry, i) => {
          const cfg = ACTION_CONFIG[entry.action as ReviewHistoryAction] ?? { label: entry.action, icon: Clock, color: 'text-slate-600 bg-slate-50 border-slate-200' };
          const Icon = cfg.icon;
          return (
            <div key={entry.id ?? i} className="relative flex gap-3">
              <div className={`relative z-10 w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${cfg.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-slate-800">{cfg.label}</p>
                {entry.notes && <p className="text-xs text-slate-500 mt-0.5">{entry.notes}</p>}
                <p className="text-xs text-slate-400 mt-1">{formatDate(entry.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

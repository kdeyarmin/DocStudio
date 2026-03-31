import { GitPullRequestArrow, CircleCheck as CheckCircle, Clock, Circle as XCircle, Loader as Loader2 } from 'lucide-react';
import type { ChangeRequestStatus } from '../../../types/doc-studio-review';
import { CHANGE_TYPE_LABELS } from '../../../types/doc-studio-review';
import { useChangeRequests, useUpdateChangeRequest } from '../../../hooks/useDocStudioReview';
import { useToast } from '../../../lib/toast';

interface Props {
  draftId: string;
  organizationId: string;
}

const STATUS_CONFIG: Record<ChangeRequestStatus, { label: string; icon: React.ElementType; className: string }> = {
  open:        { label: 'Open',        icon: Clock,         className: 'bg-amber-100 text-amber-700 border-amber-200' },
  in_progress: { label: 'In Progress', icon: Loader2,       className: 'bg-blue-100 text-blue-700 border-blue-200' },
  resolved:    { label: 'Resolved',    icon: CheckCircle,   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:    { label: 'Rejected',    icon: XCircle,       className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ReviewChangeRequestList({ draftId }: Props) {
  const { showToast } = useToast();
  const { data: requests = [], isLoading } = useChangeRequests(draftId);
  const updateRequest = useUpdateChangeRequest();

  const markResolved = async (id: string) => {
    try {
      await updateRequest.mutateAsync({ change_request_id: id, draft_id: draftId, status: 'resolved' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl">
        <GitPullRequestArrow className="w-6 h-6 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No change requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <GitPullRequestArrow className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">
          Change Requests
          <span className="ml-1.5 text-xs text-slate-400">({requests.length})</span>
        </span>
      </div>

      {requests.map(req => {
        const cfg = STATUS_CONFIG[req.status as ChangeRequestStatus] ?? STATUS_CONFIG.open;
        const Icon = cfg.icon;
        return (
          <div key={req.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {CHANGE_TYPE_LABELS[req.change_type as keyof typeof CHANGE_TYPE_LABELS] ?? req.change_type}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.className}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>
              <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
            </div>
            <p className="text-sm text-slate-700">{req.description}</p>
            {req.resolution_notes && (
              <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">{req.resolution_notes}</p>
            )}
            {req.status === 'open' && (
              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={() => markResolved(req.id)}
                  disabled={updateRequest.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark Resolved
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

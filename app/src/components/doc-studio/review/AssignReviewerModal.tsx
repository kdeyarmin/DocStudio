import { useState } from 'react';
import { X, UserCheck, Loader as Loader2 } from 'lucide-react';
import type { ReviewTaskType, ReviewTaskPriority } from '../../../types/doc-studio-review';
import { TASK_TYPE_LABELS } from '../../../types/doc-studio-review';
import { useAssignReviewer } from '../../../hooks/useDocStudioReview';
import { useToast } from '../../../lib/toast';
import { useAuth } from '../../../lib/auth';

interface Props {
  draftId: string;
  organizationId: string;
  onClose: () => void;
}

const ALL_TASK_TYPES: ReviewTaskType[] = [
  'review_content', 'review_shot_plan', 'review_narration',
  'review_captions', 'review_render_output', 'verify_accuracy',
];

export function AssignReviewerModal({ draftId, organizationId, onClose }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const assign = useAssignReviewer();

  const [reviewerId, setReviewerId] = useState(user?.id ?? '');
  const [selectedTasks, setSelectedTasks] = useState<ReviewTaskType[]>(['review_content', 'review_narration']);
  const [priority, setPriority] = useState<ReviewTaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');

  const toggleTask = (t: ReviewTaskType) => {
    setSelectedTasks(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleSubmit = async () => {
    if (!reviewerId.trim()) {
      showToast('Reviewer ID is required', 'error');
      return;
    }
    try {
      await assign.mutateAsync({
        draft_id: draftId,
        organization_id: organizationId,
        reviewer_id: reviewerId.trim(),
        task_types: selectedTasks,
        priority,
        due_date: dueDate || undefined,
      });
      showToast('Reviewer assigned successfully', 'success');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to assign reviewer', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">Assign Reviewer</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Reviewer User ID</label>
            <input
              type="text"
              value={reviewerId}
              onChange={e => setReviewerId(e.target.value)}
              placeholder="User UUID"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Defaults to your own user ID</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Review Tasks</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TASK_TYPES.map(t => (
                <label
                  key={t}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                    selectedTasks.includes(t)
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(t)}
                    onChange={() => toggleTask(t)}
                    className="sr-only"
                  />
                  {TASK_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as ReviewTaskPriority)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={assign.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {assign.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Assign Reviewer
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { MessageSquare, Plus, Send, Loader as Loader2 } from 'lucide-react';
import type { CommentType } from '../../../types/doc-studio-review';
import { useReviewComments, useAddReviewComment } from '../../../hooks/useDocStudioReview';
import { ReviewCommentThreadCard } from './ReviewCommentThread';
import { useToast } from '../../../lib/toast';

interface Props {
  draftId: string;
  organizationId: string;
}

const COMMENT_TYPES: CommentType[] = [
  'general', 'scene_feedback', 'shot_feedback',
  'narration_feedback', 'caption_feedback', 'render_feedback',
];

const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  general:            'General',
  scene_feedback:     'Scene Feedback',
  shot_feedback:      'Shot Feedback',
  narration_feedback: 'Narration Feedback',
  caption_feedback:   'Caption Feedback',
  render_feedback:    'Render Feedback',
};

export function ReviewCommentsPanel({ draftId, organizationId }: Props) {
  const { showToast } = useToast();
  const { data: rawComments = [], isLoading } = useReviewComments(draftId);
  const threads = rawComments.map((c): import('../../../types/doc-studio-review').ReviewCommentThread => ({
    root: c.root ?? c,
    replies: c.replies ?? [],
  }));
  const addComment = useAddReviewComment();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState<CommentType>('general');

  const handleAdd = async () => {
    if (!newMessage.trim()) return;
    try {
      await addComment.mutateAsync({
        draft_id: draftId,
        organization_id: organizationId,
        message: newMessage.trim(),
        comment_type: newType,
      });
      setNewMessage('');
      setShowNewForm(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add comment', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-1/4 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            Comments
            {threads.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">({threads.length})</span>
            )}
          </span>
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Comment
        </button>
      </div>

      {showNewForm && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as CommentType)}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {COMMENT_TYPES.map(t => (
              <option key={t} value={t}>{COMMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Write your comment..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={addComment.isPending || !newMessage.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Post
            </button>
          </div>
        </div>
      )}

      {threads.length === 0 && !showNewForm ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <MessageSquare className="w-6 h-6 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No comments yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Add feedback to collaborate on this tutorial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map(thread => (
            <ReviewCommentThreadCard
              key={thread.root.id}
              thread={{ root: thread.root ?? thread, replies: thread.replies ?? [] }}
              draftId={draftId}
              organizationId={organizationId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

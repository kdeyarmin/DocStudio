import { useState } from 'react';
import { MessageSquare, CheckCheck, CircleMinus as MinusCircle, CornerDownRight, Send, Loader as Loader2 } from 'lucide-react';
import type { ReviewCommentThread } from '../../../types/doc-studio-review';
import { useAddReviewComment, useResolveComment } from '../../../hooks/useDocStudioReview';
import { useToast } from '../../../lib/toast';

interface Props {
  thread: ReviewCommentThread;
  draftId: string;
  organizationId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  open:      'bg-amber-100 text-amber-700',
  resolved:  'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-500',
};

export function ReviewCommentThreadCard({ thread, draftId, organizationId }: Props) {
  const { showToast } = useToast();
  const addComment = useAddReviewComment();
  const resolveComment = useResolveComment();

  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      await addComment.mutateAsync({
        draft_id: draftId,
        organization_id: organizationId,
        message: replyText.trim(),
        comment_type: thread.root.comment_type,
        parent_comment_id: thread.root.id,
      });
      setReplyText('');
      setShowReplyBox(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add reply', 'error');
    }
  };

  const handleResolve = async () => {
    try {
      await resolveComment.mutateAsync({ comment_id: thread.root.id, draft_id: draftId });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to resolve comment', 'error');
    }
  };

  const statusColor = STATUS_COLORS[thread.root.status] ?? STATUS_COLORS.open;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 flex items-start gap-3">
        <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${statusColor}`}>
              {thread.root.status}
            </span>
            <span className="text-xs text-slate-400">{formatDate(thread.root.created_at)}</span>
          </div>
          <p className="text-sm text-slate-800 mt-1">{thread.root.message}</p>
        </div>
        {thread.root.status === 'open' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowReplyBox(v => !v)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              title="Reply"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResolve}
              disabled={resolveComment.isPending}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-colors"
              title="Resolve"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {thread.root.status === 'open' && (
          <button
            onClick={handleResolve}
            disabled={resolveComment.isPending}
            className="hidden"
          >
            <MinusCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {thread.replies.length > 0 && (
        <div className="divide-y divide-slate-100">
          {thread.replies.map(reply => (
            <div key={reply.id} className="px-4 py-2.5 flex gap-3">
              <CornerDownRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">{formatDate(reply.created_at)}</p>
                <p className="text-sm text-slate-700">{reply.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showReplyBox && (
        <div className="px-4 py-3 border-t border-slate-100 bg-white flex gap-2">
          <input
            type="text"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
            placeholder="Write a reply..."
            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleReply}
            disabled={addComment.isPending || !replyText.trim()}
            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Layers, MessageSquare, ClipboardList, GitPullRequestArrow, History, Sparkles, GitCompareArrows } from 'lucide-react';
import { ReviewOverviewPanel } from './ReviewOverviewPanel';
import { ReviewCommentsPanel } from './ReviewCommentsPanel';
import { ReviewChecklistPanel } from './ReviewChecklistPanel';
import { ReviewChangeRequestList } from './ReviewChangeRequestList';
import { ReviewHistoryTimeline } from './ReviewHistoryTimeline';
import { AIReviewInsightsPanel } from './AIReviewInsightsPanel';
import { AIReviewComparePanel } from './AIReviewComparePanel';
import { useReviewComments, useChangeRequests, useReviewTasks } from '../../../hooks/useDocStudioReview';
import { useAIReviewRuns } from '../../../hooks/useDocStudioAIReview';
import { useDocStudioIntegrityReport } from '../../../hooks/useDocStudioIntegrity';

interface Props {
  draftId: string;
  organizationId: string;
}

type SubTab = 'overview' | 'comments' | 'checklist' | 'changes' | 'history' | 'ai_insights' | 'compare';

function useBadgeCounts(draftId: string) {
  const { data: threads = [] } = useReviewComments(draftId);
  const { data: changes = [] } = useChangeRequests(draftId);
  const { data: report } = useDocStudioIntegrityReport(draftId);
  const openComments = threads.filter(t => t.root?.status === 'open').length;
  const openChanges  = changes.filter(c => c.status === 'open').length;
  const criticalFindings = (report?.failures_json ?? []).length;
  return { openComments, openChanges, criticalFindings };
}

export function ReviewTab({ draftId, organizationId }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const { openComments, openChanges, criticalFindings } = useBadgeCounts(draftId);
  const { data: tasks = [] } = useReviewTasks(draftId);
  const { data: aiRuns = [] } = useAIReviewRuns(draftId, 'approval_readiness');
  const openTasks = tasks.filter(t => t.status !== 'completed').length;
  const hasMultipleRuns = aiRuns.length >= 2;

  const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',     label: 'Overview',       icon: Layers },
    { id: 'ai_insights',  label: 'AI Insights',    icon: Sparkles },
    ...(hasMultipleRuns ? [{ id: 'compare' as SubTab, label: 'Compare', icon: GitCompareArrows }] : []),
    { id: 'comments',     label: 'Comments',        icon: MessageSquare },
    { id: 'checklist',    label: 'Checklist',       icon: ClipboardList },
    { id: 'changes',      label: 'Change Requests', icon: GitPullRequestArrow },
    { id: 'history',      label: 'History',         icon: History },
  ];

  const badgeCounts: Partial<Record<SubTab, number>> = {
    comments:    openComments    || undefined,
    changes:     openChanges     || undefined,
    overview:    openTasks       || undefined,
    ai_insights: criticalFindings || undefined,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-1 pb-3 border-b border-slate-200 flex-wrap">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const count = badgeCounts[tab.id];
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count != null && count > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 text-rose-700 text-xs font-bold leading-none">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto pt-4">
        {activeSubTab === 'overview' && (
          <ReviewOverviewPanel
            draftId={draftId}
            organizationId={organizationId}
            onNavigateToAIInsights={() => setActiveSubTab('ai_insights')}
          />
        )}
        {activeSubTab === 'ai_insights' && (
          <AIReviewInsightsPanel draftId={draftId} organizationId={organizationId} />
        )}
        {activeSubTab === 'compare' && (
          <AIReviewComparePanel draftId={draftId} organizationId={organizationId} />
        )}
        {activeSubTab === 'comments' && (
          <ReviewCommentsPanel draftId={draftId} organizationId={organizationId} />
        )}
        {activeSubTab === 'checklist' && (
          <ReviewChecklistPanel draftId={draftId} organizationId={organizationId} />
        )}
        {activeSubTab === 'changes' && (
          <ReviewChangeRequestList draftId={draftId} organizationId={organizationId} />
        )}
        {activeSubTab === 'history' && (
          <ReviewHistoryTimeline draftId={draftId} />
        )}
      </div>
    </div>
  );
}

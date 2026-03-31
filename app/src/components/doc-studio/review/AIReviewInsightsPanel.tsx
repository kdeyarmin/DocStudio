import { useState, useMemo } from 'react';
import {
  TriangleAlert as AlertTriangle,
  Circle as XCircle,
  Info,
  CircleCheck as CheckCircle2,
  MessageSquare,
  GitPullRequestArrow,
  Film,
  Aperture,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader as Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useDocStudioIntegrityReport } from '../../../hooks/useDocStudioIntegrity';
import {
  useReviewChecklist, useChangeRequests, useReviewComments,
  useAddReviewComment, useCreateChangeRequest,
} from '../../../hooks/useDocStudioReview';
import {
  useLatestAIReviewRun, useRunAIReview,
  useSuggestionActions, useRecordSuggestionAction,
} from '../../../hooks/useDocStudioAIReview';
import { INTEGRITY_CATEGORY_LABELS } from '../../../types/documentation';
import { CHANGE_TYPE_LABELS } from '../../../types/doc-studio-review';
import type { IntegrityCategory } from '../../../types/documentation';
import type { ChangeRequestType, ChecklistResult, ChecklistTemplate } from '../../../types/doc-studio-review';
import type { DocStudioDraft } from '../../../types/doc-studio';
import type { ApprovalReadinessPayload } from '../../../providers/review/TutorialReviewProvider';
import type { AIReviewRun, AISuggestionAction } from '../../../types/doc-studio-review';

interface Props {
  draftId: string;
  organizationId: string;
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

interface Finding {
  key: string;
  severity: 'critical' | 'warning' | 'info';
  category: IntegrityCategory;
  message: string;
  code: string;
  scene_id?: string;
  asset_id?: string;
  blocking?: boolean;
}

interface CategoryGroupDef {
  label: string;
  categories: IntegrityCategory[];
  scoreFields: Array<keyof Record<string, number | null>>;
}

const CATEGORY_GROUPS: CategoryGroupDef[] = [
  { label: 'Content',   categories: ['content', 'scene'],                   scoreFields: ['content_integrity_score', 'scene_integrity_score'] },
  { label: 'Narration', categories: ['narration', 'caption'],               scoreFields: ['narration_integrity_score', 'caption_integrity_score'] },
  { label: 'Visual',    categories: ['capture', 'screenshot', 'shot_plan'], scoreFields: ['capture_integrity_score', 'screenshot_integrity_score', 'shot_plan_integrity_score'] },
  { label: 'Output',    categories: ['render', 'drift'],                    scoreFields: ['render_integrity_score', 'drift_integrity_score'] },
];

const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  warning:  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  info:     { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-400' },
};

const CR_TYPE_OPTIONS: ChangeRequestType[] = [
  'regenerate_scene', 'adjust_shot_plan', 'update_narration',
  'fix_caption', 'regenerate_render', 'recapture_workflow',
];

const VERDICT_CONFIG: Record<string, { label: string; classes: string }> = {
  pass:             { label: 'Pass',             classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pass_with_notes:  { label: 'Pass w/ Notes',    classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  needs_work:       { label: 'Needs Work',        classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  fail:             { label: 'Blocked',           classes: 'bg-red-100 text-red-700 border-red-200' },
};

const STALE_HOURS = 24;

function runIsStale(run: AIReviewRun): boolean {
  const ms = Date.now() - new Date(run.created_at).getTime();
  return ms > STALE_HOURS * 60 * 60 * 1000;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

// ─── Inline forms ─────────────────────────────────────────────────────────────

function InlineCommentForm({
  draftId, organizationId, sceneId, prefill, onDone,
}: { draftId: string; organizationId: string; sceneId?: string; prefill: string; onDone: () => void }) {
  const [message, setMessage] = useState(prefill);
  const addComment = useAddReviewComment();
  const handleSubmit = () => {
    if (!message.trim()) return;
    addComment.mutate({
      draft_id: draftId,
      organization_id: organizationId,
      comment_type: sceneId ? 'scene_feedback' : 'general',
      message: message.trim(),
      scene_id: sceneId,
    }, { onSuccess: onDone });
  };
  return (
    <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={2}
        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="Add your comment..."
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={addComment.isPending || !message.trim()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
          Add Comment
        </button>
        <button onClick={onDone} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}

function InlineCRForm({
  draftId, organizationId, prefillDescription, prefillType, onDone,
}: { draftId: string; organizationId: string; prefillDescription: string; prefillType: ChangeRequestType; onDone: () => void }) {
  const [type, setType] = useState<ChangeRequestType>(prefillType);
  const [description, setDescription] = useState(prefillDescription);
  const createCR = useCreateChangeRequest();
  const handleSubmit = () => {
    if (!description.trim()) return;
    createCR.mutate({
      draft_id: draftId,
      organization_id: organizationId,
      change_type: type,
      description: description.trim(),
    }, { onSuccess: onDone });
  };
  return (
    <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
      <select
        value={type}
        onChange={e => setType(e.target.value as ChangeRequestType)}
        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {CR_TYPE_OPTIONS.map(t => (
          <option key={t} value={t}>{CHANGE_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="Describe the required change..."
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={createCR.isPending || !description.trim()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50"
        >
          {createCR.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitPullRequestArrow className="w-3 h-3" />}
          Create Request
        </button>
        <button onClick={onDone} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}

// ─── Integrity Finding Row ────────────────────────────────────────────────────

function FindingRow({ finding, draftId, organizationId }: { finding: Finding; draftId: string; organizationId: string }) {
  const [expanded, setExpanded] = useState<null | 'comment' | 'cr'>(null);
  const colors = SEVERITY_COLORS[finding.severity];
  const SevIcon = finding.severity === 'critical' ? XCircle : finding.severity === 'warning' ? AlertTriangle : Info;

  const defaultCRType: ChangeRequestType =
    finding.category === 'narration' || finding.category === 'caption' ? 'update_narration' :
    finding.category === 'scene' ? 'regenerate_scene' :
    finding.category === 'shot_plan' ? 'adjust_shot_plan' :
    finding.category === 'render' ? 'regenerate_render' :
    finding.category === 'capture' ? 'recapture_workflow' : 'fix_caption';

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
      <div className="flex items-start gap-2.5">
        <SevIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${colors.badge}`}>
              {finding.severity}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600 font-medium">
              {INTEGRITY_CATEGORY_LABELS[finding.category]}
            </span>
            {finding.code && (
              <span className="text-[10px] text-slate-400 font-mono">{finding.code}</span>
            )}
            {finding.scene_id && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                <Film className="w-2.5 h-2.5" />
                Scene ref
              </span>
            )}
            {finding.asset_id && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-50 text-slate-600 border border-slate-200 font-medium">
                <Aperture className="w-2.5 h-2.5" />
                Asset ref
              </span>
            )}
            {finding.blocking && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-red-100 text-red-700 font-semibold">
                BLOCKING
              </span>
            )}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{finding.message}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(expanded === 'comment' ? null : 'comment')}
            title="Add comment"
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors border border-transparent hover:border-blue-200"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comment</span>
          </button>
          <button
            onClick={() => setExpanded(expanded === 'cr' ? null : 'cr')}
            title="Create change request"
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors border border-transparent hover:border-rose-200"
          >
            <GitPullRequestArrow className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Request</span>
          </button>
        </div>
      </div>
      {expanded === 'comment' && (
        <InlineCommentForm
          draftId={draftId}
          organizationId={organizationId}
          sceneId={finding.scene_id}
          prefill={`[${INTEGRITY_CATEGORY_LABELS[finding.category]}] ${finding.message}`}
          onDone={() => setExpanded(null)}
        />
      )}
      {expanded === 'cr' && (
        <InlineCRForm
          draftId={draftId}
          organizationId={organizationId}
          prefillDescription={finding.message}
          prefillType={defaultCRType}
          onDone={() => setExpanded(null)}
        />
      )}
    </div>
  );
}

// ─── AI Suggestion Row ────────────────────────────────────────────────────────

interface SuggestionRowProps {
  runId: string;
  draftId: string;
  organizationId: string;
  suggestionKey: string;
  label: string;
  detail: string;
  hint: string;
  severity: 'hard' | 'soft' | 'rec';
  existingAction: AISuggestionAction | undefined;
  suggestionJson: Record<string, unknown>;
}

function SuggestionRow({
  runId, draftId, organizationId, suggestionKey, label, detail, hint,
  severity, existingAction, suggestionJson,
}: SuggestionRowProps) {
  const [showCR, setShowCR] = useState(false);
  const record = useRecordSuggestionAction();

  const act = (action: 'accepted' | 'dismissed') => {
    record.mutate({
      draftId, organizationId, runId,
      suggestionKey, suggestionJson, action,
    });
  };

  const handleConvert = async (crId: string) => {
    await record.mutateAsync({
      draftId, organizationId, runId,
      suggestionKey, suggestionJson,
      action: 'converted_to_cr',
      changeRequestId: crId,
    });
    setShowCR(false);
  };

  const actionLabel = existingAction
    ? existingAction.action === 'accepted'        ? 'Accepted'
    : existingAction.action === 'dismissed'       ? 'Dismissed'
    : 'Converted'
    : null;

  const severityBg =
    severity === 'hard' ? 'border-red-200 bg-red-50/50' :
    severity === 'soft' ? 'border-amber-200 bg-amber-50/50' :
    'border-sky-200 bg-sky-50/50';

  const severityBadge =
    severity === 'hard' ? 'bg-red-100 text-red-700' :
    severity === 'soft' ? 'bg-amber-100 text-amber-700' :
    'bg-sky-100 text-sky-700';

  return (
    <div className={`rounded-lg border ${severityBg} p-3`}>
      <div className="flex items-start gap-2.5">
        {severity === 'hard' ? <XCircle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" /> :
         severity === 'soft' ? <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" /> :
         <Info className="w-4 h-4 mt-0.5 text-sky-600 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${severityBadge}`}>
              {severity === 'hard' ? 'Hard Blocker' : severity === 'soft' ? 'Soft Blocker' : 'Recommendation'}
            </span>
            {label && (
              <span className="text-[10px] text-slate-400 font-mono">{label}</span>
            )}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium mb-0.5">{detail}</p>
          {hint && (
            <p className="text-[11px] text-slate-500 italic">{hint}</p>
          )}
        </div>
        {actionLabel ? (
          <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-1 rounded border ${
            existingAction?.action === 'accepted'       ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            existingAction?.action === 'dismissed'      ? 'bg-slate-100 text-slate-500 border-slate-200 line-through' :
            'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {actionLabel}
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => act('accepted')}
              disabled={record.isPending}
              title="Accept suggestion"
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors border border-transparent hover:border-emerald-200"
            >
              {record.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Accept</span>
            </button>
            <button
              onClick={() => act('dismissed')}
              disabled={record.isPending}
              title="Dismiss"
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors border border-transparent hover:border-slate-200"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dismiss</span>
            </button>
            {severity !== 'rec' && (
              <button
                onClick={() => setShowCR(v => !v)}
                title="Convert to change request"
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors border border-transparent hover:border-rose-200"
              >
                <GitPullRequestArrow className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Request</span>
              </button>
            )}
          </div>
        )}
      </div>
      {showCR && (
        <ConvertToCRForm
          draftId={draftId}
          organizationId={organizationId}
          prefillDescription={detail}
          onSuccess={handleConvert}
          onDone={() => setShowCR(false)}
        />
      )}
    </div>
  );
}

function ConvertToCRForm({
  draftId, organizationId, prefillDescription, onSuccess, onDone,
}: { draftId: string; organizationId: string; prefillDescription: string; onSuccess: (id: string) => void; onDone: () => void }) {
  const [type, setType] = useState<ChangeRequestType>('regenerate_scene');
  const [description, setDescription] = useState(prefillDescription);
  const createCR = useCreateChangeRequest();
  const handleSubmit = () => {
    if (!description.trim()) return;
    createCR.mutate({
      draft_id: draftId,
      organization_id: organizationId,
      change_type: type,
      description: description.trim(),
    }, {
      onSuccess: (data) => {
        const cr = (data as { change_request?: { id: string } })?.change_request;
        if (cr?.id) onSuccess(cr.id);
        else onDone();
      },
    });
  };
  return (
    <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
      <select
        value={type}
        onChange={e => setType(e.target.value as ChangeRequestType)}
        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {CR_TYPE_OPTIONS.map(t => (
          <option key={t} value={t}>{CHANGE_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={createCR.isPending || !description.trim()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50"
        >
          {createCR.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitPullRequestArrow className="w-3 h-3" />}
          Create & Link
        </button>
        <button onClick={onDone} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}

// ─── AI Provider Review Section ───────────────────────────────────────────────

interface AIProviderSectionProps {
  draftId: string;
  organizationId: string;
  payload: ApprovalReadinessPayload | null;
}

function AIProviderSection({ draftId, organizationId, payload }: AIProviderSectionProps) {
  const { data: latestRun, isLoading: runLoading } = useLatestAIReviewRun(draftId, 'approval_readiness');
  const { data: actions = [] } = useSuggestionActions(latestRun?.id ?? null);
  const runMutation = useRunAIReview();
  const [expanded, setExpanded] = useState(true);

  const handleRun = () => {
    if (!payload) return;
    runMutation.mutate({ payload, runLabel: new Date().toLocaleDateString() });
  };

  const isStale = latestRun ? runIsStale(latestRun) : false;
  const verdictCfg = latestRun ? VERDICT_CONFIG[latestRun.verdict] : null;

  const resultJson = (latestRun?.result_json ?? {}) as {
    hard_blockers?: Array<{ code: string; category: string; description: string; resolution_hint: string }>;
    soft_blockers?: Array<{ code: string; category: string; description: string; resolution_hint: string }>;
    top_recommendations?: string[];
    approval_summary?: string;
    reviewer_guidance?: string;
  };

  const hardBlockers  = resultJson.hard_blockers ?? [];
  const softBlockers  = resultJson.soft_blockers ?? [];
  const recommendations = resultJson.top_recommendations ?? [];

  const actionMap = new Map(actions.map(a => [a.suggestion_key, a]));

  const actedCount  = actions.length;
  const totalItems  = hardBlockers.length + softBlockers.length + recommendations.length;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-700">AI Provider Review</span>
          {latestRun && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${verdictCfg?.classes}`}>
              {verdictCfg?.label}
            </span>
          )}
          {isStale && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
              <Clock className="w-3 h-3" />
              Stale
            </span>
          )}
          {latestRun && totalItems > 0 && actedCount > 0 && (
            <span className="text-[11px] text-slate-400">
              {actedCount}/{totalItems} actioned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {latestRun && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(latestRun.created_at)}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Run header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {latestRun ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <ScoreRing score={latestRun.overall_score} size={48} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-700">{Math.round(latestRun.overall_score)}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600">
                      {latestRun.hard_blocker_count} hard · {latestRun.soft_blocker_count} soft blockers
                    </div>
                    {latestRun.model && (
                      <div className="text-[10px] text-slate-400 font-mono">{latestRun.model}</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No AI review run yet.</p>
              )}
            </div>
            <button
              onClick={handleRun}
              disabled={runMutation.isPending || !payload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {runMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
                : latestRun
                ? <><RefreshCw className="w-3.5 h-3.5" /> Re-run AI Review</>
                : <><Sparkles className="w-3.5 h-3.5" /> Run AI Review</>
              }
            </button>
          </div>

          {runLoading && (
            <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading last run…
            </div>
          )}

          {latestRun && resultJson.approval_summary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="text-xs text-slate-500 font-medium mb-1">AI Summary</p>
              <p className="text-xs text-slate-700 leading-relaxed">{resultJson.approval_summary}</p>
            </div>
          )}

          {latestRun && (hardBlockers.length > 0 || softBlockers.length > 0 || recommendations.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Blockers & Recommendations</span>
                {actedCount === totalItems && totalItems > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCheck className="w-3 h-3" />
                    All actioned
                  </span>
                )}
              </div>
              {hardBlockers.map(b => (
                <SuggestionRow
                  key={`hard-${b.code}`}
                  runId={latestRun.id}
                  draftId={draftId}
                  organizationId={organizationId}
                  suggestionKey={`hard-${b.code}`}
                  label={b.code}
                  detail={b.description}
                  hint={b.resolution_hint}
                  severity="hard"
                  existingAction={actionMap.get(`hard-${b.code}`)}
                  suggestionJson={b as unknown as Record<string, unknown>}
                />
              ))}
              {softBlockers.map(b => (
                <SuggestionRow
                  key={`soft-${b.code}`}
                  runId={latestRun.id}
                  draftId={draftId}
                  organizationId={organizationId}
                  suggestionKey={`soft-${b.code}`}
                  label={b.code}
                  detail={b.description}
                  hint={b.resolution_hint}
                  severity="soft"
                  existingAction={actionMap.get(`soft-${b.code}`)}
                  suggestionJson={b as unknown as Record<string, unknown>}
                />
              ))}
              {recommendations.map((rec, i) => (
                <SuggestionRow
                  key={`rec-${i}`}
                  runId={latestRun.id}
                  draftId={draftId}
                  organizationId={organizationId}
                  suggestionKey={`rec-${i}`}
                  label=""
                  detail={rec}
                  hint=""
                  severity="rec"
                  existingAction={actionMap.get(`rec-${i}`)}
                  suggestionJson={{ recommendation: rec }}
                />
              ))}
            </div>
          )}

          {latestRun && resultJson.reviewer_guidance && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-blue-700 text-xs font-semibold mb-1">
                <ArrowRight className="w-3 h-3" />
                Reviewer Guidance
              </div>
              <p className="text-xs text-blue-700 leading-relaxed">{resultJson.reviewer_guidance}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIReviewInsightsPanel({ draftId, organizationId }: Props) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['critical']));

  const { data: report, isLoading: reportLoading } = useDocStudioIntegrityReport(draftId);
  const { data: checklistData } = useReviewChecklist(draftId);
  const { data: changeRequests = [] } = useChangeRequests(draftId);
  const { data: comments = [] } = useReviewComments(draftId);

  const { data: draftRow } = useQuery({
    queryKey: ['doc-studio-draft-minimal', draftId],
    queryFn: async () => {
      const { data } = await supabase
        .from('doc_studio_drafts')
        .select('id, title, target_role, output_type')
        .eq('id', draftId)
        .maybeSingle();
      return data;
    },
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });

  const { data: sceneCount = 0 } = useQuery({
    queryKey: ['doc-studio-scene-count', draftId],
    queryFn: async () => {
      const { count } = await supabase
        .from('doc_studio_scenes')
        .select('id', { count: 'exact', head: true })
        .eq('draft_id', draftId);
      return count ?? 0;
    },
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });

  const findings = useMemo<Finding[]>(() => {
    if (!report) return [];
    const out: Finding[] = [];
    (report.failures_json ?? []).forEach((f, i) =>
      out.push({ key: `fail-${i}`, severity: 'critical', category: f.category, message: f.message, code: f.code, scene_id: f.scene_id, asset_id: f.asset_id, blocking: f.blocking })
    );
    (report.warnings_json ?? []).forEach((w, i) =>
      out.push({ key: `warn-${i}`, severity: 'warning', category: w.category, message: w.message, code: w.code, scene_id: w.scene_id, asset_id: w.asset_id })
    );
    (report.recommendations_json ?? []).forEach((r, i) =>
      out.push({ key: `rec-${i}`, severity: 'info', category: r.category, message: r.action + (r.detail ? ` — ${r.detail}` : ''), code: `REC-${r.priority.toUpperCase()}` })
    );
    return out;
  }, [report]);

  const filteredFindings = useMemo(() =>
    severityFilter === 'all' ? findings : findings.filter(f => f.severity === severityFilter),
    [findings, severityFilter]
  );

  const findingsByCategory = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of filteredFindings) {
      const key = f.category;
      const categoryFindings = map.get(key);
      if (categoryFindings) {
        categoryFindings.push(f);
      } else {
        map.set(key, [f]);
      }
    }
    return map;
  }, [filteredFindings]);

  const checklistGroupMap = checklistData
    ? (() => {
        const resultMap = new Map<string, ChecklistResult>(checklistData.results.map((r) => [r.checklist_item_id, r]));
        const groups: Record<string, { pass: number; total: number }> = {};
        for (const tmpl of checklistData.templates as ChecklistTemplate[]) {
          if (!tmpl.is_active) continue;
          const cat = tmpl.category;
          if (!groups[cat]) groups[cat] = { pass: 0, total: 0 };
          if (tmpl.is_required) groups[cat].total++;
          if (resultMap.get(tmpl.id)?.passed) groups[cat].pass++;
        }
        return groups;
      })()
    : null;

  const overallChecklistPass  = checklistGroupMap ? Object.values(checklistGroupMap).reduce((a, g) => a + g.pass, 0) : 0;
  const overallChecklistTotal = checklistGroupMap ? Object.values(checklistGroupMap).reduce((a, g) => a + g.total, 0) : 0;

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount  = findings.filter(f => f.severity === 'warning').length;
  const infoCount     = findings.filter(f => f.severity === 'info').length;
  const openCRs       = changeRequests.filter(c => c.status === 'open').length;
  const openComments  = comments.filter(c => c.status === 'open').length;

  const readiness: { label: string; color: string; Icon: React.ElementType } =
    criticalCount > 0 || (report?.overall_score ?? 100) < 40
      ? { label: 'Blocked', color: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX }
      : warningCount > 3 || (report?.overall_score ?? 100) < 70
      ? { label: 'Needs Attention', color: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert }
      : { label: 'Ready for Approval', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck };

  const overallScore = report?.overall_score ?? 0;

  const getGroupScore = (def: CategoryGroupDef): number | null => {
    if (!report) return null;
    const vals: number[] = [];
    const r = report as unknown as Record<string, number | null>;
    for (const field of def.scoreFields) {
      const v = r[field as string];
      if (typeof v === 'number') vals.push(v);
    }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const checklistGroupsForPayload = checklistData
    ? (() => {
        const resultMap = new Map(checklistData.results.map(r => [r.checklist_item_id, r]));
        const catMap = new Map<string, { template: typeof checklistData.templates[0]; result: typeof checklistData.results[0] | null }[]>();
        for (const tmpl of checklistData.templates) {
          if (!catMap.has(tmpl.category)) catMap.set(tmpl.category, []);
          catMap.get(tmpl.category)!.push({ template: tmpl, result: resultMap.get(tmpl.id) ?? null });
        }
        return Array.from(catMap.entries()).map(([category, items]) => ({
          category: category as import('../../../types/doc-studio-review').ChecklistCategory,
          items,
          passCount: items.filter(i => i.result?.passed).length,
          totalRequired: items.filter(i => i.template.is_required).length,
        }));
      })()
    : undefined;

  const aiPayload: ApprovalReadinessPayload | null = draftRow
    ? {
        context: {
          draftId,
          organizationId,
          draftTitle:     draftRow.title ?? 'Untitled',
          targetRole:     draftRow.target_role ?? 'user',
          outputType:     draftRow.output_type ?? 'tutorial',
          totalSceneCount: sceneCount,
        },
        draft: draftRow as unknown as DocStudioDraft,
        integrityReport: report ?? null,
        checklistGroups: checklistGroupsForPayload,
        openChangeRequestCount: openCRs,
        openCommentCount: openComments,
      }
    : null;

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading review insights...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* AI Provider Review Section */}
      <AIProviderSection
        draftId={draftId}
        organizationId={organizationId}
        payload={aiPayload}
      />

      {/* Integrity Findings (existing) */}
      {report && (
        <>
          {/* Approval Readiness Banner */}
          <div className={`rounded-xl border p-4 ${readiness.color}`}>
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <ScoreRing score={overallScore} size={64} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-700">{overallScore}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <readiness.Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{readiness.label}</span>
                  <span className="text-xs opacity-70">Integrity score</span>
                </div>
                <div className="flex gap-4 flex-wrap text-xs">
                  {criticalCount > 0 && (
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span className="font-semibold">{criticalCount}</span> failure{criticalCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-semibold">{warningCount}</span> warning{warningCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {openCRs > 0 && (
                    <span className="flex items-center gap-1">
                      <GitPullRequestArrow className="w-3.5 h-3.5" />
                      <span className="font-semibold">{openCRs}</span> open request{openCRs !== 1 ? 's' : ''}
                    </span>
                  )}
                  {overallChecklistTotal > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="font-semibold">{overallChecklistPass}/{overallChecklistTotal}</span> checklist items
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Category Scorecards */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Category Scores</h4>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_GROUPS.map(group => {
                const groupScore = getGroupScore(group);
                const groupFindings = findings.filter(f => (group.categories as string[]).includes(f.category));
                const crit = groupFindings.filter(f => f.severity === 'critical').length;
                const warn = groupFindings.filter(f => f.severity === 'warning').length;
                const clGroup = checklistGroupMap?.[group.label.toLowerCase()];
                const checklistPct = clGroup?.total ? Math.round((clGroup.pass / clGroup.total) * 100) : null;
                return (
                  <div
                    key={group.label}
                    className={`rounded-lg border p-3 ${
                      crit > 0 ? 'border-red-200 bg-red-50/50' :
                      warn > 0 ? 'border-amber-200 bg-amber-50/50' :
                      'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 mb-1">{group.label}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {crit > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
                              <XCircle className="w-3 h-3" />{crit}
                            </span>
                          )}
                          {warn > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                              <AlertTriangle className="w-3 h-3" />{warn}
                            </span>
                          )}
                          {checklistPct !== null && (
                            <span className="text-[10px] text-slate-500">{checklistPct}% checked</span>
                          )}
                          {crit === 0 && warn === 0 && checklistPct === null && (
                            <span className="text-[10px] text-emerald-600 font-medium">Clean</span>
                          )}
                        </div>
                      </div>
                      {groupScore !== null && (
                        <div className="relative flex-shrink-0">
                          <ScoreRing score={groupScore} size={42} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-700">{groupScore}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {groupScore !== null && (
                      <div className="mt-2 h-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            groupScore >= 80 ? 'bg-emerald-500' : groupScore >= 60 ? 'bg-amber-400' : 'bg-red-500'
                          }`}
                          style={{ width: `${groupScore}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { id: 'all',      label: 'All Findings', count: findings.length },
              { id: 'critical', label: 'Failures',  count: criticalCount },
              { id: 'warning',  label: 'Warnings',  count: warningCount },
              { id: 'info',     label: 'Suggestions', count: infoCount },
            ] as Array<{ id: SeverityFilter; label: string; count: number }>).map(f => (
              <button
                key={f.id}
                onClick={() => setSeverityFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  severityFilter === f.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.id === 'critical' && <XCircle className="w-3 h-3" />}
                {f.id === 'warning'  && <AlertTriangle className="w-3 h-3" />}
                {f.id === 'info'     && <Info className="w-3 h-3" />}
                {f.label}
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  severityFilter === f.id ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                }`}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Grouped Findings */}
          <div className="space-y-3">
            {filteredFindings.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                No findings for the selected filter.
              </div>
            ) : (
              (Array.from(findingsByCategory.entries()) as [string, Finding[]][]).map(([cat, catFindings]) => {
                const isExpanded = expandedGroups.has(cat);
                const hasCritical = catFindings.some(f => f.severity === 'critical');
                const hasWarning  = catFindings.some(f => f.severity === 'warning');
                return (
                  <div key={cat} className="rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => toggleGroup(cat)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors ${
                        hasCritical ? 'bg-red-50 hover:bg-red-100' :
                        hasWarning  ? 'bg-amber-50 hover:bg-amber-100' :
                        'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {INTEGRITY_CATEGORY_LABELS[cat as IntegrityCategory] ?? cat}
                        </span>
                        <span className="text-[10px] text-slate-400">({catFindings.length} finding{catFindings.length !== 1 ? 's' : ''})</span>
                        <div className="flex gap-1">
                          {hasCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
                          {hasWarning  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {isExpanded && (
                      <div className="p-2.5 space-y-2">
                        {catFindings.map(finding => (
                          <FindingRow key={finding.key} finding={finding} draftId={draftId} organizationId={organizationId} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {!report && !reportLoading && (
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <Info className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">No integrity report available</p>
          <p className="text-xs text-slate-400 mt-1">Run an integrity check to see detailed findings.</p>
        </div>
      )}
    </div>
  );
}

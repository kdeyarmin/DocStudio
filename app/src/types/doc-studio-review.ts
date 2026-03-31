export type ReviewWorkflowStage =
  | 'draft'
  | 'automated_checks'
  | 'awaiting_review'
  | 'review_in_progress'
  | 'changes_requested'
  | 'ready_for_approval'
  | 'approved'
  | 'ready_for_render'
  | 'rendered'
  | 'archived';

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'on_hold';

export type ReviewTaskType =
  | 'review_content'
  | 'review_shot_plan'
  | 'review_narration'
  | 'review_captions'
  | 'review_render_output'
  | 'verify_accuracy';

export type ReviewTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'rejected';
export type ReviewTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type CommentType =
  | 'general'
  | 'scene_feedback'
  | 'shot_feedback'
  | 'narration_feedback'
  | 'caption_feedback'
  | 'render_feedback';

export type CommentStatus = 'open' | 'resolved' | 'dismissed';

export type ChangeRequestType =
  | 'regenerate_scene'
  | 'adjust_shot_plan'
  | 'update_narration'
  | 'fix_caption'
  | 'regenerate_render'
  | 'recapture_workflow';

export type ChangeRequestStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

export type ChecklistCategory = 'content' | 'narration' | 'visual' | 'output';

export type ReviewHistoryAction =
  | 'reviewer_assigned'
  | 'review_started'
  | 'comment_added'
  | 'change_requested'
  | 'change_resolved'
  | 'tutorial_approved'
  | 'tutorial_rejected'
  | 'stage_advanced'
  | 'checklist_updated'
  | 'ai_review_run'
  | 'suggestion_actioned';

export type AIReviewRunType = 'approval_readiness' | 'scene' | 'shot_plan' | 'narration' | 'captions';
export type AIReviewVerdict = 'pass' | 'pass_with_notes' | 'needs_work' | 'fail';
export type AISuggestionActionType = 'accepted' | 'dismissed' | 'converted_to_cr';

// ─── DB Models ────────────────────────────────────────────────────────────────

export interface ReviewWorkflow {
  id: string;
  draft_id: string;
  organization_id: string;
  workflow_stage: ReviewWorkflowStage;
  review_status: ReviewStatus;
  assigned_reviewer_id: string | null;
  assigned_by_id: string | null;
  requested_changes_json: Record<string, unknown> | null;
  reviewer_notes: string | null;
  approval_notes: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  ai_review_required: boolean;
  required_ai_run_id: string | null;
  created_at: string;
  updated_at: string;
  draft?: {
    id: string;
    title: string;
    integrity_score: number | null;
    integrity_status: string | null;
    updated_at: string;
    review_stage: string | null;
  };
}

export interface ReviewTask {
  id: string;
  draft_id: string;
  organization_id: string;
  reviewer_id: string | null;
  task_type: ReviewTaskType;
  status: ReviewTaskStatus;
  priority: ReviewTaskPriority;
  due_date: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewComment {
  id: string;
  draft_id: string;
  organization_id: string;
  scene_id: string | null;
  shot_id: string | null;
  comment_type: CommentType;
  author_id: string | null;
  parent_comment_id: string | null;
  message: string;
  status: CommentStatus;
  resolved_by_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  /** Present when comment is used as a thread with nested structure */
  root?: ReviewComment;
  replies?: ReviewComment[];
}

export interface ReviewCommentThread {
  root: ReviewComment;
  replies: ReviewComment[];
}

export interface ChangeRequest {
  id: string;
  draft_id: string;
  organization_id: string;
  change_type: ChangeRequestType;
  requested_by_id: string | null;
  assigned_to_id: string | null;
  description: string;
  status: ChangeRequestStatus;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplate {
  id: string;
  category: ChecklistCategory;
  item_key: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistResult {
  id: string;
  draft_id: string;
  organization_id: string;
  checklist_item_id: string;
  reviewer_id: string | null;
  passed: boolean | null;
  notes: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewHistoryEntry {
  id: string;
  draft_id: string;
  organization_id: string;
  action: ReviewHistoryAction;
  actor_id: string | null;
  notes: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AIReviewRun {
  id: string;
  draft_id: string;
  organization_id: string;
  review_type: AIReviewRunType;
  scene_id: string | null;
  run_label: string | null;
  result_json: Record<string, unknown>;
  overall_score: number;
  verdict: AIReviewVerdict;
  hard_blocker_count: number;
  soft_blocker_count: number;
  model: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AISuggestionAction {
  id: string;
  draft_id: string;
  organization_id: string;
  ai_review_run_id: string;
  suggestion_key: string;
  suggestion_json: Record<string, unknown>;
  action: AISuggestionActionType;
  change_request_id: string | null;
  notes: string | null;
  acted_by: string | null;
  acted_at: string;
}

// ─── Aggregated / UI types ────────────────────────────────────────────────────

export interface ReviewDashboardData {
  workflows: ReviewWorkflow[];
  reviewer_workload: Record<string, number>;
}

export interface ChecklistGroup {
  category: ChecklistCategory;
  items: Array<{
    template: ChecklistTemplate;
    result: ChecklistResult | null;
  }>;
  passCount: number;
  totalRequired: number;
}

// ─── Mutation params ──────────────────────────────────────────────────────────

export interface AssignReviewerParams {
  draft_id: string;
  organization_id?: string;
  reviewer_id: string;
  task_types?: ReviewTaskType[];
  priority?: ReviewTaskPriority;
  due_date?: string;
}

export interface RequestChangesParams {
  draft_id: string;
  organization_id?: string;
  changes: Array<{
    change_type: ChangeRequestType;
    description: string;
    assigned_to_id?: string;
  }>;
}

// ─── Display config ───────────────────────────────────────────────────────────

export const WORKFLOW_STAGE_LABELS: Record<ReviewWorkflowStage, string> = {
  draft:               'Draft',
  automated_checks:    'Automated Checks',
  awaiting_review:     'Awaiting Review',
  review_in_progress:  'Review In Progress',
  changes_requested:   'Changes Requested',
  ready_for_approval:  'Ready for Approval',
  approved:            'Approved',
  ready_for_render:    'Ready for Render',
  rendered:            'Rendered',
  archived:            'Archived',
};

export const WORKFLOW_STAGE_COLORS: Record<ReviewWorkflowStage, string> = {
  draft:               'bg-slate-100 text-slate-600 border-slate-200',
  automated_checks:    'bg-sky-100 text-sky-700 border-sky-200',
  awaiting_review:     'bg-amber-100 text-amber-700 border-amber-200',
  review_in_progress:  'bg-blue-100 text-blue-700 border-blue-200',
  changes_requested:   'bg-rose-100 text-rose-700 border-rose-200',
  ready_for_approval:  'bg-violet-100 text-violet-700 border-violet-200',
  approved:            'bg-emerald-100 text-emerald-700 border-emerald-200',
  ready_for_render:    'bg-blue-100 text-blue-700 border-blue-200',
  rendered:            'bg-cyan-100 text-cyan-700 border-cyan-200',
  archived:            'bg-slate-100 text-slate-500 border-slate-200',
};

export const TASK_TYPE_LABELS: Record<ReviewTaskType, string> = {
  review_content:       'Review Content',
  review_shot_plan:     'Review Shot Plan',
  review_narration:     'Review Narration',
  review_captions:      'Review Captions',
  review_render_output: 'Review Render Output',
  verify_accuracy:      'Verify Accuracy',
};

export const CHANGE_TYPE_LABELS: Record<ChangeRequestType, string> = {
  regenerate_scene:   'Regenerate Scene',
  adjust_shot_plan:   'Adjust Shot Plan',
  update_narration:   'Update Narration',
  fix_caption:        'Fix Caption',
  regenerate_render:  'Regenerate Render',
  recapture_workflow: 'Recapture Workflow',
};

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  content:   'Content',
  narration: 'Narration',
  visual:    'Visual',
  output:    'Output',
};

export const PIPELINE_STAGES: ReviewWorkflowStage[] = [
  'draft',
  'automated_checks',
  'awaiting_review',
  'review_in_progress',
  'changes_requested',
  'ready_for_approval',
  'approved',
  'ready_for_render',
  'rendered',
];

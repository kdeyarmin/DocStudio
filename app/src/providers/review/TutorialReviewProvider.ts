import type {
  DocumentationScene,
  DocumentationNarrationSegment,
  DocumentationShotPlan,
  CaptionBlock,
} from '../../types/documentation';
import type { DocStudioDraft } from '../../types/doc-studio';
import type { TutorialIntegrityReport } from '../../types/documentation';
import type { ChecklistGroup } from '../../types/doc-studio-review';

// ─── Shared primitives ────────────────────────────────────────────────────────

export type ReviewSeverity = 'info' | 'warning' | 'critical';
export type ReviewVerdict = 'approved' | 'needs_minor_changes' | 'needs_major_changes' | 'blocked';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ReviewIssue {
  code: string;
  severity: ReviewSeverity;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ReviewSuggestion {
  type: 'rewrite' | 'trim' | 'expand' | 'restructure' | 'replace' | 'annotate';
  target: string;
  recommendation: string;
  example?: string;
}

export interface ReviewContext {
  draftId: string;
  organizationId: string;
  draftTitle: string;
  targetRole: string;
  outputType: string;
  totalSceneCount: number;
}

// ─── Scene Review ─────────────────────────────────────────────────────────────

export interface SceneReviewPayload {
  context: ReviewContext;
  scene: DocumentationScene;
  sceneIndex: number;
  previousSceneSummary?: string | null;
  nextSceneSummary?: string | null;
}

export interface SceneReviewDimension {
  name: string;
  score: number;
  rationale: string;
}

export interface SceneReviewResult {
  scene_id: string;
  overall_score: number;
  verdict: ReviewVerdict;
  dimensions: SceneReviewDimension[];
  issues: ReviewIssue[];
  suggestions: ReviewSuggestion[];
  title_assessment: string;
  summary_assessment: string;
  flow_assessment: string;
  confidence: ConfidenceLevel;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

// ─── Shot Plan Review ─────────────────────────────────────────────────────────

export interface ShotPlanReviewPayload {
  context: ReviewContext;
  scene: DocumentationScene;
  shots: DocumentationShotPlan[];
  narrationSegments?: DocumentationNarrationSegment[];
}

export interface ShotPlanReviewEntry {
  shot_id: string;
  shot_title: string;
  framing_quality_score: number;
  timing_alignment_score: number;
  callout_effectiveness_score: number;
  purpose_clarity: string;
  issues: ReviewIssue[];
  recommendations: string[];
}

export interface ShotPlanReviewResult {
  scene_id: string | null;
  overall_coverage_score: number;
  narration_sync_score: number;
  shot_sequence_verdict: ReviewVerdict;
  shots: ShotPlanReviewEntry[];
  missing_coverage_areas: string[];
  redundant_shots: string[];
  sequence_flow_notes: string;
  issues: ReviewIssue[];
  confidence: ConfidenceLevel;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

// ─── Narration Review ─────────────────────────────────────────────────────────

export interface NarrationReviewPayload {
  context: ReviewContext;
  segments: DocumentationNarrationSegment[];
  sceneContext?: Array<{ scene_id: string; scene_title: string; scene_summary: string | null }>;
  targetDurationSeconds?: number | null;
}

export interface NarrationSegmentReview {
  segment_id: string;
  scene_id: string | null;
  clarity_score: number;
  pacing_score: number;
  tone_consistency_score: number;
  word_count: number;
  estimated_duration_seconds: number;
  issues: ReviewIssue[];
  corrections: Array<{ original: string; corrected: string; reason: string }>;
  rewrite_suggestion?: string;
}

export interface NarrationReviewResult {
  overall_clarity_score: number;
  overall_pacing_score: number;
  overall_tone_consistency_score: number;
  total_estimated_duration_seconds: number;
  target_duration_seconds: number | null;
  duration_delta_seconds: number | null;
  verdict: ReviewVerdict;
  segments: NarrationSegmentReview[];
  global_issues: ReviewIssue[];
  style_consistency_notes: string;
  pacing_notes: string;
  role_alignment_notes: string;
  confidence: ConfidenceLevel;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

// ─── Caption Review ───────────────────────────────────────────────────────────

export interface CaptionReviewPayload {
  context: ReviewContext;
  captionBlocks: CaptionBlock[];
  narrationSegments?: DocumentationNarrationSegment[];
  totalDurationSeconds?: number;
}

export interface CaptionBlockReview {
  block_index: number;
  text_quality_score: number;
  timing_quality_score: number;
  issues: ReviewIssue[];
  corrected_text?: string;
}

export interface CaptionReviewResult {
  overall_quality_score: number;
  synchronization_score: number;
  readability_score: number;
  coverage_score: number;
  verdict: ReviewVerdict;
  block_reviews: CaptionBlockReview[];
  global_issues: ReviewIssue[];
  gap_count: number;
  overlap_count: number;
  average_block_duration_seconds: number;
  line_length_assessment: string;
  synchronization_notes: string;
  confidence: ConfidenceLevel;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

// ─── Approval Readiness Evaluation ───────────────────────────────────────────

export interface ApprovalReadinessPayload {
  context: ReviewContext;
  draft: DocStudioDraft;
  integrityReport: TutorialIntegrityReport | null;
  checklistGroups?: ChecklistGroup[];
  openChangeRequestCount: number;
  openCommentCount: number;
  sceneReviews?: SceneReviewResult[];
  narrationReview?: NarrationReviewResult | null;
  captionReview?: CaptionReviewResult | null;
}

export interface ApprovalBlocker {
  code: string;
  category: string;
  description: string;
  severity: 'hard' | 'soft';
  resolution_hint: string;
}

export interface ApprovalDimension {
  name: string;
  score: number;
  status: 'pass' | 'warn' | 'fail';
  notes: string;
}

export interface ApprovalReadinessResult {
  overall_readiness_score: number;
  verdict: 'approved' | 'conditionally_approved' | 'needs_work' | 'blocked';
  confidence: ConfidenceLevel;
  dimensions: ApprovalDimension[];
  hard_blockers: ApprovalBlocker[];
  soft_blockers: ApprovalBlocker[];
  approval_summary: string;
  reviewer_guidance: string;
  estimated_revision_effort: 'none' | 'minor' | 'moderate' | 'major' | 'rebuild';
  top_recommendations: string[];
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface TutorialReviewProvider {
  readonly name: string;

  reviewScene(
    payload: SceneReviewPayload,
  ): Promise<SceneReviewResult>;

  reviewShotPlan(
    payload: ShotPlanReviewPayload,
  ): Promise<ShotPlanReviewResult>;

  reviewNarration(
    payload: NarrationReviewPayload,
  ): Promise<NarrationReviewResult>;

  reviewCaptions(
    payload: CaptionReviewPayload,
  ): Promise<CaptionReviewResult>;

  evaluateApprovalReadiness(
    payload: ApprovalReadinessPayload,
  ): Promise<ApprovalReadinessResult>;
}

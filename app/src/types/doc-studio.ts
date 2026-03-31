export type DraftStatus = 'draft' | 'generating' | 'review' | 'approved' | 'published' | 'archived';
export type OutputType = 'screenshot_guide' | 'video_tutorial' | 'narrated_video';
export type ProviderMode = 'mock' | 'playwright' | 'stagehand';
export type TargetRole = 'admin' | 'provider' | 'staff' | 'patient';
export type AssetType = 'screenshot' | 'video' | 'audio' | 'attachment';
export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';

export interface DocStudioStep {
  index: number;
  title: string;
  description: string;
  action?: string;
  selector?: string;
  url?: string;
}

export interface GeneratedContent {
  guide_md?: string;
  transcript?: string;
  narration_script?: string;
  metadata?: Record<string, unknown>;
}

export interface EditedContent {
  guide_md?: string;
  transcript?: string;
  narration_script?: string;
}

export interface CompletenessChecklistItem {
  key: string;
  label: string;
  passed: boolean;
}

export interface DocStudioDraft {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  description: string;
  target_url: string;
  output_type: OutputType;
  provider_mode: ProviderMode;
  status: DraftStatus;
  version_label: string;
  target_role: TargetRole;
  steps: DocStudioStep[];
  generated_content: GeneratedContent;
  edited_content: EditedContent;
  completeness_score: number;
  publish_notes: string;
  published_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  integrity_status: import('./documentation').IntegrityStatus | null;
  integrity_score: number | null;
  revalidation_required: boolean;
  last_captured_at: string | null;
  drift_deepened_at: string | null;
  created_at: string;
  updated_at: string;
  assembly_status?: string;
  assets?: DocStudioAsset[];
  reviews?: DocStudioReview[];
}

export interface DocStudioAsset {
  id: string;
  draft_id: string;
  organization_id: string;
  asset_type: AssetType;
  step_index: number | null;
  screenshot_role: import('./documentation').ScreenshotRole | null;
  storage_path: string;
  public_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DocStudioReview {
  id: string;
  draft_id: string;
  organization_id: string;
  reviewer_id: string | null;
  decision: ReviewDecision;
  notes: string;
  completeness_score: number;
  checklist_json: CompletenessChecklistItem[];
  created_at: string;
}

export type AssemblyStatus = 'pending' | 'assembling' | 'assembled' | 'failed';

export interface DraftListItem {
  id: string;
  title: string;
  description: string;
  output_type: OutputType;
  status: DraftStatus;
  version_label: string;
  target_role: TargetRole;
  completeness_score: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps: DocStudioStep[];
  assembly_status?: AssemblyStatus | null;
  last_assembled_at?: string | null;
  package_version?: string | null;
  integrity_status?: import('./documentation').IntegrityStatus | null;
  integrity_score?: number | null;
  revalidation_required?: boolean;
  review_workflow_stage?: string | null;
}

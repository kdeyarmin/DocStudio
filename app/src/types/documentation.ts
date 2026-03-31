export type WorkflowAutomationMode = 'mock' | 'playwright' | 'stagehand';

export type JobStatus =
  | 'queued'
  | 'preparing'
  | 'running'
  | 'capturing'
  | 'scene_assembly'
  | 'generating_content'
  | 'generating_narration'
  | 'quality_scoring'
  | 'ready_for_review'
  | 'needs_manual_step'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StepActionType =
  | 'visit_url'
  | 'click'
  | 'type'
  | 'select'
  | 'wait'
  | 'assert_text'
  | 'assert_url'
  | 'screenshot'
  | 'hover'
  | 'keypress'
  | 'extract_text'
  | 'upload_file'
  | 'conditional_branch';

export type WaitStrategy =
  | 'network_idle'
  | 'selector_visible'
  | 'selector_hidden'
  | 'fixed_delay'
  | 'url_change'
  | 'none';

export type ErrorHandlingStrategy = 'fail' | 'retry' | 'skip' | 'fallback_to_manual_step';

export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'role' | 'testid';

export type AssetType =
  | 'screenshot'
  | 'video'
  | 'audio'
  | 'trace'
  | 'attachment'
  | 'failure_screenshot';

export type ScreenshotRole =
  | 'hero'
  | 'context'
  | 'step'
  | 'recovery'
  | 'cover'
  | 'validation'
  | 'failure';

export type AssetStatus = 'uploading' | 'ready' | 'error';

export type JobEventSeverity = 'info' | 'warning' | 'error' | 'success';

export type SceneQualityStatus = 'pending' | 'good' | 'needs_review' | 'incomplete';

export type NarrationStyle = 'instructional' | 'conversational' | 'formal' | 'concise';

export type NarrationSegmentStatus = 'draft' | 'generating' | 'ready' | 'error';

export type PronunciationCategory =
  | 'product'
  | 'healthcare'
  | 'specialty'
  | 'medication'
  | 'abbreviation'
  | 'general';

export type PronunciationReplacementMode = 'phonetic' | 'substitute' | 'ssml' | 'none';

export type QualityTier =
  | 'excellent'
  | 'good'
  | 'needs_review'
  | 'needs_recapture'
  | 'outdated'
  | 'incomplete';

export type DriftStatus = 'current' | 'warning' | 'outdated' | 'unknown';

export type DriftSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type TutorialRoleVariant =
  | 'provider'
  | 'billing'
  | 'intake_staff'
  | 'scheduler'
  | 'admin'
  | 'executive'
  | 'clinical_manager';

export interface DocumentationWorkflow {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  tutorial_group: string | null;
  target_role: string | null;
  description: string | null;
  start_url: string;
  success_url_pattern: string | null;
  automation_mode: WorkflowAutomationMode;
  estimated_duration_seconds: number;
  requires_auth: boolean;
  uses_demo_account: boolean;
  default_output_type: string;
  is_active: boolean;
  is_playwright_ready: boolean;
  settings: Record<string, unknown>;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  steps?: DocumentationWorkflowStep[];
}

export interface DocumentationWorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  title: string;
  description: string | null;
  action_type: StepActionType;
  target_selector: string;
  action_value: string | null;
  expected_result: string | null;
  wait_strategy: WaitStrategy;
  screenshot_checkpoint: boolean;
  screenshot_caption_template: string;
  fallback_instruction: string | null;
  timeout_seconds: number;
  ai_observation_prompt: string | null;
  is_optional: boolean;
  error_handling_strategy: ErrorHandlingStrategy;
  retry_count: number;
  selector_strategy: SelectorStrategy;
  step_metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentationJob {
  id: string;
  workflow_id: string | null;
  draft_id: string | null;
  organization_id: string | null;
  tutorial_group: string | null;
  environment: string | null;
  target_role: string | null;
  output_type: string | null;
  provider_mode: WorkflowAutomationMode;
  priority: string | null;
  version_label: string | null;
  custom_title: string | null;
  notes: string | null;
  status: JobStatus;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  asset_count: number;
  completed_step_count: number;
  failure_screenshot_count: number;
  logs_json: Record<string, unknown>;
  execution_summary_json: RichExecutionSummary | Record<string, unknown>;
  step_results_json: StepExecutionResult[];
  error_message: string | null;
  metadata_json: Record<string, unknown>;
  provider_run_id: string | null;
  selected_demo_account_id: string | null;
  content_generated_at: string | null;
  narration_generated_at: string | null;
  scene_assembly_at: string | null;
  quality_scored_at: string | null;
  created_at: string;
  updated_at: string;
  workflow?: DocumentationWorkflow;
  events?: DocumentationJobEvent[];
  assets?: DocumentationAsset[];
  demo_account?: DocumentationDemoAccount;
}

export interface DocumentationJobEvent {
  id: string;
  job_id: string;
  event_type: string;
  title: string | null;
  description: string | null;
  severity: JobEventSeverity;
  payload_json: Record<string, unknown>;
  step_id: string | null;
  step_order: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface DocumentationAsset {
  id: string;
  job_id: string | null;
  draft_id: string | null;
  step_id: string | null;
  scene_id: string | null;
  asset_type: AssetType;
  screenshot_role: ScreenshotRole;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
  caption: string | null;
  is_cover: boolean;
  is_cover_candidate: boolean;
  is_drift_eligible: boolean;
  excluded_from_guide: boolean;
  checkpoint_type: string | null;
  asset_status: AssetStatus;
  checksum: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  metadata_json: Record<string, unknown>;
  highlight_metadata_json: Record<string, unknown>;
  visual_emphasis_json: VisualEmphasisMetadata | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentationSettings {
  id: string;
  key: string;
  value_json: Record<string, unknown>;
  updated_at: string;
}

export interface PlaywrightSettings {
  provider_active: WorkflowAutomationMode;
  playwright_enabled: boolean;
  playwright_runner_url: string;
  playwright_base_url: string;
  playwright_login_path: string;
  playwright_username_selector: string;
  playwright_password_selector: string;
  playwright_submit_selector: string;
  playwright_success_url_pattern: string;
  viewport_width: number;
  viewport_height: number;
  headless: boolean;
  trace_enabled: boolean;
  screenshots_enabled: boolean;
  video_enabled: boolean;
  retain_partial_assets_on_failure: boolean;
  step_timeout_ms: number;
  action_timeout_ms: number;
  navigation_timeout_ms: number;
}

export const DEFAULT_PLAYWRIGHT_SETTINGS: PlaywrightSettings = {
  provider_active: 'mock',
  playwright_enabled: false,
  playwright_runner_url: '',
  playwright_base_url: '',
  playwright_login_path: '/login',
  playwright_username_selector: 'input[name="email"]',
  playwright_password_selector: 'input[name="password"]',
  playwright_submit_selector: 'button[type="submit"]',
  playwright_success_url_pattern: '/dashboard',
  viewport_width: 1280,
  viewport_height: 800,
  headless: true,
  trace_enabled: true,
  screenshots_enabled: true,
  video_enabled: true,
  retain_partial_assets_on_failure: true,
  step_timeout_ms: 30000,
  action_timeout_ms: 10000,
  navigation_timeout_ms: 30000,
};

export const SETTINGS_KEY = 'playwright_config';
export const SCENE_GENERATION_CONFIG_KEY = 'scene_generation_config';
export const NARRATION_ADVANCED_CONFIG_KEY = 'narration_advanced_config';
export const QUALITY_SETTINGS_CONFIG_KEY = 'quality_settings_config';
export const DRIFT_SETTINGS_CONFIG_KEY = 'drift_settings_config';

export interface DocumentationDemoAccount {
  id: string;
  organization_id: string | null;
  name: string;
  environment: 'demo' | 'staging';
  role: string | null;
  username_hint: string | null;
  description: string | null;
  is_active: boolean;
  base_url: string;
  login_path: string;
  login_selectors: {
    username: string;
    password: string;
    submit: string;
    successUrlPattern: string;
  };
  env_password_key: string;
  created_at: string;
  updated_at: string;
}

export interface RetryAttemptLog {
  attempt: number;
  error: string;
  selector_tried: string;
  strategy_tried: string;
  duration_ms: number;
  failure_screenshot_asset_id?: string;
}

export interface StepTiming {
  step_order: number;
  title: string;
  duration_ms: number;
  status: 'success' | 'failed' | 'skipped';
}

export interface RichExecutionSummary {
  total_steps: number;
  successful_steps: number;
  failed_steps: number;
  skipped_steps: number;
  asset_count: number;
  duration_seconds: number;
  auth_duration_ms: number;
  total_retry_count: number;
  fallback_used_count: number;
  failure_screenshot_count: number;
  step_timings: StepTiming[];
  slowest_step: StepTiming | null;
  fastest_step: StepTiming | null;
}

export interface StepExecutionResult {
  step_id: string;
  step_order: number;
  title: string;
  action_type: StepActionType;
  status: 'success' | 'failed' | 'skipped' | 'retried';
  duration_ms: number;
  retry_attempts: number;
  used_fallback: boolean;
  extracted_text?: string;
  screenshot_asset_id?: string;
  error?: string;
  selector_used?: string;
  selector_strategy_used?: string;
  retry_log?: RetryAttemptLog[];
  started_at: string;
  completed_at: string;
}

export interface AutomationRunResult {
  job_id: string;
  provider_run_id: string;
  status: JobStatus;
  step_results: StepExecutionResult[];
  screenshot_asset_ids: string[];
  video_asset_id?: string;
  trace_asset_id?: string;
  duration_seconds: number;
  error?: string;
  execution_summary: Record<string, unknown>;
}

export interface TriggerJobPayload {
  workflow_id: string;
  organization_id: string;
  provider_mode: WorkflowAutomationMode;
  draft_id?: string;
  demo_account_id?: string;
  version_label?: string;
  custom_title?: string;
  notes?: string;
  output_type?: string;
  environment?: string;
}

// ─── Advanced Tutorial Production Types ──────────────────────────────────────

export interface VisualEmphasisMetadata {
  focus_selector?: string;
  focus_bounding_box?: { x: number; y: number; width: number; height: number } | null;
  zoom_region?: { x: number; y: number; width: number; height: number } | null;
  highlight_region?: { x: number; y: number; width: number; height: number } | null;
  callout_title?: string;
  callout_description?: string;
  callout_timing_seconds?: number;
  action_emphasis_type?: 'click' | 'type' | 'navigate' | 'submit' | 'select' | 'highlight' | null;
}

export interface DocumentationScene {
  id: string;
  draft_id: string;
  job_id: string | null;
  workflow_id: string | null;
  scene_order: number;
  title: string;
  summary: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  duration_seconds: number;
  quality_status: SceneQualityStatus;
  notes: string | null;
  visual_emphasis_json: VisualEmphasisMetadata | Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  steps?: DocumentationSceneStep[];
  /** Alias used by ScenesTab when joining scene_steps via Supabase */
  scene_steps?: DocumentationSceneStep[];
  narration_segments?: DocumentationNarrationSegment[];
  assets?: DocumentationAsset[];
  /** Aggregate count returned by some queries */
  narration_count?: number;
  /** Aggregate count returned by some queries */
  asset_count?: number;
}

export interface DocumentationSceneStep {
  id: string;
  scene_id: string;
  workflow_step_id: string | null;
  step_order: number;
  action?: string | null;
  title?: string | null;
  description?: string | null;
  step_result_json: StepExecutionResult | Record<string, unknown>;
  created_at: string;
}

export interface NarrationTimingMetadata {
  total_duration_ms?: number;
  words?: Array<{ word: string; start_ms: number; end_ms: number }>;
  characters?: Array<{ char: string; start_ms: number; end_ms: number }>;
  alignment_confidence?: number;
  generated_by?: string;
}

export interface CaptionBlock {
  id: string;
  scene_id: string | null;
  segment_order?: number;
  start_time_seconds?: number;
  end_time_seconds?: number;
  start_ms?: number;
  end_ms?: number;
  text: string;
}

export interface CaptionManifest {
  draft_id: string;
  draft_title: string;
  total_duration_seconds?: number;
  total_duration_ms?: number;
  scene_count: number;
  blocks?: CaptionBlock[];
  caption_blocks?: EnhancedCaptionBlock[];
  coverage_pct?: number;
  source?: 'pipeline' | 'manual' | 'imported';
  schema_version?: string;
  generated_at: string;
}

export interface DocumentationNarrationSegment {
  id: string;
  draft_id: string;
  scene_id: string | null;
  segment_order: number;
  narration_text: string;
  short_narration_text: string | null;
  style: NarrationStyle;
  target_duration_seconds: number | null;
  duration_seconds?: number | null;
  transcript_text: string | null;
  caption_text: string | null;
  timing_json: NarrationTimingMetadata | Record<string, unknown>;
  timing_metadata?: NarrationTimingMetadata | Record<string, unknown>;
  audio_asset_id: string | null;
  status: NarrationSegmentStatus;
  created_at: string;
  updated_at: string;
}

export interface PronunciationDictionaryEntry {
  id: string;
  term: string;
  phonetic_spelling: string | null;
  category: PronunciationCategory;
  notes: string | null;
  is_enabled: boolean;
  replacement_mode: PronunciationReplacementMode;
  substitute_text: string | null;
  provider_compat: string[];
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QualityWarning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  field?: string;
}

export interface DocStudioQualityScore {
  id: string;
  draft_id: string;
  overall_score: number;
  completion_score: number;
  screenshot_score: number;
  narration_score: number;
  transcript_score: number;
  structure_score: number;
  drift_score: number;
  assembly_score: number;
  caption_score: number;
  timing_score: number;
  export_readiness_score: number;
  render_readiness_score?: number;
  quality_tier: QualityTier;
  warnings_json: QualityWarning[];
  recommendation: string | null;
  calculated_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocStudioDriftCheck {
  id: string;
  draft_id: string;
  asset_id: string | null;
  drift_status: DriftStatus;
  severity: DriftSeverity;
  reason: string | null;
  baseline_metadata_json: Record<string, unknown>;
  comparison_metadata_json: Record<string, unknown>;
  checked_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleVariantContent {
  role: TutorialRoleVariant;
  guide_md: string;
  narration_script: string;
  key_tips: string[];
  emphasis_notes: string;
  generated_at: string;
}

export interface SceneSyncMap {
  draft_id: string;
  scenes: Array<{
    scene_id: string;
    scene_order: number;
    title: string;
    start_time_seconds: number;
    end_time_seconds: number;
    narration_segment_id: string | null;
    audio_asset_id: string | null;
    caption_blocks: CaptionBlock[];
  }>;
  total_duration_seconds: number;
}

export interface TutorialExportPackage {
  draft_id: string;
  title: string;
  version_label: string;
  target_role: string;
  tutorial_group: string;
  quality_tier: QualityTier;
  overall_quality_score: number;
  scene_count: number;
  narration_segment_count: number;
  guide_markdown: string;
  narration_script: string;
  scenes: DocumentationScene[];
  narration_segments: DocumentationNarrationSegment[];
  caption_manifest: CaptionManifest;
  scene_sync_map: SceneSyncMap;
  quality_score: DocStudioQualityScore | null;
  drift_checks: DocStudioDriftCheck[];
  role_variants: RoleVariantContent[];
  asset_manifest: Array<{
    id: string;
    file_name: string;
    file_url: string;
    asset_type: AssetType;
    screenshot_role: ScreenshotRole;
    scene_id: string | null;
  }>;
  exported_at: string;
}

// ─── Settings Structures ─────────────────────────────────────────────────────

export interface SceneGenerationConfig {
  enabled: boolean;
  default_grouping_mode: 'auto' | 'manual' | 'step_count';
  max_steps_per_scene: number;
  split_on_major_navigation: boolean;
  split_on_form_submission: boolean;
  split_on_modal_open: boolean;
  split_on_modal_close: boolean;
  min_scene_duration_seconds: number;
  max_scenes_per_tutorial: number;
}

export interface NarrationAdvancedConfig {
  narration_enabled: boolean;
  per_scene_narration: boolean;
  generate_concise_variant: boolean;
  generate_alternate_wording: boolean;
  target_speech_pace_wpm: number;
  duration_strategy: 'natural' | 'target' | 'strict';
  style_default: NarrationStyle;
  apply_pronunciation_dictionary: boolean;
  max_segment_duration_seconds: number;
}

export interface QualitySettingsConfig {
  min_screenshot_coverage_pct: number;
  min_hero_screenshot_count: number;
  transcript_required: boolean;
  narration_required: boolean;
  drift_warning_threshold_days: number;
  auto_mark_review_if_score_below: number;
  excellent_threshold: number;
  good_threshold: number;
  needs_review_threshold: number;
  min_audio_coverage_pct: number;
  min_caption_coverage_pct: number;
  timing_required: boolean;
  min_export_readiness_score: number;
}

export interface DriftSettingsConfig {
  drift_tracking_enabled: boolean;
  hero_screenshot_baseline_auto: boolean;
  manual_validation_required: boolean;
  comparison_sensitivity: 'low' | 'medium' | 'high';
  revalidation_interval_days: number;
  auto_flag_after_major_release: boolean;
}

export const DEFAULT_SCENE_GENERATION_CONFIG: SceneGenerationConfig = {
  enabled: true,
  default_grouping_mode: 'auto',
  max_steps_per_scene: 5,
  split_on_major_navigation: true,
  split_on_form_submission: true,
  split_on_modal_open: true,
  split_on_modal_close: false,
  min_scene_duration_seconds: 5,
  max_scenes_per_tutorial: 12,
};

export const DEFAULT_NARRATION_ADVANCED_CONFIG: NarrationAdvancedConfig = {
  narration_enabled: true,
  per_scene_narration: true,
  generate_concise_variant: true,
  generate_alternate_wording: false,
  target_speech_pace_wpm: 140,
  duration_strategy: 'natural',
  style_default: 'instructional',
  apply_pronunciation_dictionary: true,
  max_segment_duration_seconds: 45,
};

export const DEFAULT_QUALITY_SETTINGS_CONFIG: QualitySettingsConfig = {
  min_screenshot_coverage_pct: 60,
  min_hero_screenshot_count: 1,
  transcript_required: false,
  narration_required: false,
  drift_warning_threshold_days: 60,
  auto_mark_review_if_score_below: 50,
  excellent_threshold: 85,
  good_threshold: 70,
  needs_review_threshold: 50,
  min_audio_coverage_pct: 80,
  min_caption_coverage_pct: 60,
  timing_required: false,
  min_export_readiness_score: 60,
};

export const DEFAULT_DRIFT_SETTINGS_CONFIG: DriftSettingsConfig = {
  drift_tracking_enabled: true,
  hero_screenshot_baseline_auto: true,
  manual_validation_required: false,
  comparison_sensitivity: 'medium',
  revalidation_interval_days: 90,
  auto_flag_after_major_release: true,
};

// ─── Assembly Pipeline Types ──────────────────────────────────────────────────

export type AssemblyStatus =
  | 'not_started'
  | 'assembling_audio'
  | 'assembling_captions'
  | 'assembling_package'
  | 'assembled'
  | 'assembly_failed'
  | 'partial';

export type SceneAudioMapStatus =
  | 'pending'
  | 'audio_ready'
  | 'captions_ready'
  | 'complete'
  | 'missing_audio'
  | 'missing_transcript'
  | 'error';

export type PackageExportType =
  | 'json'
  | 'package_json'
  | 'timing_json'
  | 'caption_json'
  | 'scene_manifest'
  | 'asset_manifest'
  | 'narration_script'
  | 'transcript'
  | 'quality_summary'
  | 'srt'
  | 'vtt'
  | 'zip_bundle'
  | 'render_manifest';

export type PackageExportStatus = 'pending' | 'generating' | 'ready' | 'completed' | 'error';

export type CaptionExportFormat = 'srt' | 'vtt' | 'raw' | 'json';

export interface SceneTimingBlock {
  scene_id: string;
  scene_order?: number;
  scene_position?: number;
  title?: string;
  scene_title?: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  narration_segment_timings: Array<{
    segment_id: string;
    segment_order?: number;
    start_ms: number;
    end_ms: number;
    duration_ms: number;
    word_count: number;
    char_count?: number;
  }>;
  screenshot_display_timings: Array<{
    asset_id: string;
    display_start_ms?: number;
    display_end_ms?: number;
    role?: 'main' | 'hero' | 'context';
    start_ms?: number;
    end_ms?: number;
    display_duration_ms?: number;
  }>;
  caption_timing_blocks: Array<{
    block_id?: string;
    start_ms: number;
    end_ms: number;
    text: string;
  }>;
  transition_timing_placeholder: {
    type: 'cut' | 'fade' | 'slide';
    duration_ms: number;
  };
  callout_timing_placeholders: Array<{
    callout_id?: string;
    start_ms: number;
    duration_ms?: number;
    title?: string;
    scene_id?: string;
    label?: string;
  }>;
}

export interface TutorialTimingManifest {
  draft_id: string;
  draft_title?: string;
  total_duration_seconds?: number;
  total_duration_ms: number;
  total_scenes?: number;
  scene_count?: number;
  assembled_at?: string;
  assembly_status?: AssemblyStatus;
  generated_at?: string;
  schema_version?: string;
  scenes: SceneTimingBlock[];
  quality_notes?: string[];
  estimated?: boolean;
  global_transitions?: Array<{ after_scene_id: string; type: string; duration_ms: number }>;
  global_audio_offset_ms?: number;
  provider?: string;
}

export interface AudioAssemblyRecord {
  id: string;
  draft_id: string;
  organization_id: string;
  status: AssemblyStatus;
  total_duration_seconds: number;
  audio_coverage_pct?: number;
  scene_count: number;
  assembled_scene_count: number;
  timing_manifest_json: TutorialTimingManifest | Record<string, unknown>;
  assembly_metadata_json: Record<string, unknown>;
  error_message: string | null;
  notes: string | null;
  assembled_by: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface EnhancedCaptionBlock extends CaptionBlock {
  start_ms?: number;
  end_ms?: number;
  scene_title?: string;
  narration_segment_id?: string;
  line_count?: number;
  word_count?: number;
  script_text?: string;
  transcript_text?: string;
  diff_score?: number;
  source?: 'timing' | 'estimated' | 'manual';
  confidence?: number;
  words?: Array<{ word: string; start_ms: number; end_ms: number }>;
}

export interface ScriptTranscriptDiff {
  scene_id?: string;
  scene_title?: string;
  script_text?: string;
  transcript_text?: string | null;
  similarity_score?: number;
  similarity_pct?: number;
  has_significant_diff?: boolean;
  has_significant_drift?: boolean;
  diff_notes?: string | null;
  script_word_count?: number;
  transcript_word_count?: number;
  added_words?: string[];
  deleted_words?: string[];
}

export interface CaptionManifestRecord {
  id: string;
  draft_id: string;
  organization_id: string;
  format?: 'json' | 'srt' | 'vtt';
  version?: number;
  caption_json?: EnhancedCaptionBlock[];
  caption_blocks?: EnhancedCaptionBlock[];
  total_blocks?: number;
  total_caption_count?: number;
  total_duration_seconds?: number;
  total_duration_ms?: number;
  scene_count?: number;
  scene_coverage_pct?: number;
  script_vs_transcript_diff_json?: ScriptTranscriptDiff[] | null;
  export_formats_available?: CaptionExportFormat[];
  generated_at?: string;
  source?: 'pipeline' | 'manual' | 'imported';
  schema_version?: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageSceneManifestEntry {
  scene_id: string;
  scene_order?: number;
  scene_position?: number;
  title?: string;
  scene_title?: string;
  summary?: string | null;
  duration_seconds: number;
  narration_segment_id?: string | null;
  has_audio: boolean;
  has_captions: boolean;
  has_transcript?: boolean;
  has_screenshot?: boolean;
  has_timing?: boolean;
  screenshot_count?: number;
  hero_screenshot_id?: string | null;
  audio_asset_id?: string | null;
  caption_block_count?: number;
  narration_word_count?: number;
  quality_status?: SceneQualityStatus;
  assembly_status?: SceneAudioMapStatus;
}

export interface PackageAssetManifestEntry {
  id?: string;
  asset_id?: string;
  file_name?: string;
  file_url?: string;
  url?: string | null;
  asset_type: AssetType;
  screenshot_role?: ScreenshotRole;
  scene_id: string | null;
  file_size?: number;
  file_size_bytes?: number;
  mime_type?: string;
  duration_seconds?: number;
  is_cover?: boolean;
}

export interface PackageVariantSummary {
  role?: TutorialRoleVariant;
  slug?: string;
  label?: string;
  scene_count?: number;
  has_guide?: boolean;
  has_narration_script?: boolean;
  has_narration?: boolean;
  has_captions?: boolean;
  key_tips_count?: number;
  duration_seconds?: number;
  generated_at?: string;
}

export interface TutorialPackageManifest {
  draft_id: string;
  draft_title?: string;
  title?: string;
  package_version?: string;
  version_label?: string;
  target_role?: string;
  tutorial_group?: string;
  output_type?: string;
  quality_tier?: QualityTier;
  overall_quality_score?: number;
  assembly_status?: AssemblyStatus;
  total_duration_seconds?: number;
  total_estimated_duration_seconds?: number;
  total_scenes?: number;
  scene_count?: number;
  asset_count?: number;
  narration_segment_count?: number;
  caption_block_count?: number;
  audio_coverage_pct: number;
  caption_coverage_pct: number;
  scenes: PackageSceneManifestEntry[];
  assets: PackageAssetManifestEntry[];
  variants: PackageVariantSummary[];
  timing_manifest?: TutorialTimingManifest;
  quality_summary: {
    overall_score: number;
    tier: QualityTier;
    warning_count: number;
    critical_warning_count: number;
    audio_completeness: number;
    caption_coverage: number;
    timing_manifest_completeness: number;
    package_assembly_completeness: number;
    export_readiness: number;
  };
  drift_summary: {
    total_checks: number;
    current_count: number;
    warning_count: number;
    outdated_count: number;
    overall_status: DriftStatus;
  };
  generated_at?: string;
  schema_version?: string;
  assembled_at?: string;
  exported_at?: string;
}

export interface PackageExportRecord {
  id: string;
  draft_id: string;
  organization_id: string;
  export_type: PackageExportType;
  status: PackageExportStatus;
  manifest_json?: TutorialPackageManifest | Record<string, unknown>;
  package_manifest?: TutorialPackageManifest | Record<string, unknown>;
  scene_count: number;
  total_duration_seconds?: number;
  package_version?: string;
  exported_at?: string;
  error_log?: string | null;
  asset_count: number;
  quality_summary_json: Record<string, unknown> | null;
  file_path: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  exported_by: string;
  created_at: string;
  updated_at: string;
}

export interface SceneAudioMapRecord {
  id: string;
  scene_id: string;
  draft_id: string;
  organization_id: string;
  narration_segment_id: string | null;
  audio_asset_id: string | null;
  scene_position?: number;
  estimated_duration_seconds: number;
  actual_duration_seconds: number | null;
  duration_seconds?: number | null;
  has_transcript: boolean;
  has_captions: boolean;
  has_audio: boolean;
  assembly_status: SceneAudioMapStatus;
  status?: SceneAudioMapStatus | 'ready' | 'segment_only' | 'missing';
  is_complete?: boolean;
  timing_json?: NarrationTimingMetadata | Record<string, unknown> | null;
  timing_metadata?: NarrationTimingMetadata | Record<string, unknown> | null;
  scene_audio_map?: Array<Record<string, unknown>>;
  missing_asset_warnings: string[];
  created_at: string;
  updated_at: string;
  scene?: DocumentationScene;
  narration_segment?: DocumentationNarrationSegment;
}

export interface AssemblyHealthSummary {
  draft_id: string;
  draftId?: string;
  total_scenes: number;
  totalScenes?: number;
  complete_scenes: number;
  audio_ready_scenes: number;
  captions_ready_scenes: number;
  missing_audio_scenes: number;
  missing_transcript_scenes: number;
  error_scenes: number;
  overall_status: AssemblyStatus;
  audio_coverage_pct: number;
  audioCoveragePct?: number;
  caption_coverage_pct: number;
  captionCoveragePct?: number;
  estimated_total_duration_seconds: number;
  warnings: string[];
  blockingIssues?: string[];
  warningIssues?: string[];
  isReadyForAssembly?: boolean;
}

// ─── ElevenLabs Alignment & Timing Ingestion ─────────────────────────────────

export interface ElevenLabsAlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_durations_seconds: number[];
}

export interface TimingIngestionResult {
  segmentId: string;
  timingMetadata: NarrationTimingMetadata;
  durationSeconds: number;
  wordCount: number;
  persisted: boolean;
}

// ─── Audio Replacement Workflow ───────────────────────────────────────────────

export interface AudioReplacementRecord {
  id: string;
  draft_id: string;
  scene_id: string;
  old_audio_asset_id: string | null;
  new_audio_asset_id: string;
  old_duration_seconds: number | null;
  new_duration_seconds: number | null;
  replaced_by: string | null;
  replaced_at: string;
  reason: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface AudioReplacementPayload {
  draftId: string;
  organizationId: string;
  sceneId: string;
  segmentId: string;
  newAudioAssetId: string;
  newDurationSeconds?: number;
  newTimingMetadata?: NarrationTimingMetadata;
  reason?: string;
}

// ─── Settings Types ───────────────────────────────────────────────────────────

export interface AssemblyConfig {
  enable_scene_audio_assembly: boolean;
  duration_estimation_mode: 'wpm_based' | 'character_based' | 'fixed';
  fallback_on_missing_audio: 'use_placeholder' | 'skip_scene' | 'fail_assembly';
  allow_partial_assembly: boolean;
  silence_gap_seconds: number;
  target_wpm: number;
}

export interface CaptionExportConfig {
  caption_block_length_target_words: number;
  split_long_narration: boolean;
  multiline_max_lines: number;
  enabled_export_formats: Array<'json' | 'srt' | 'vtt'>;
}

export interface PackageExportConfig {
  include_quality_summary: boolean;
  include_drift_summary: boolean;
  include_variants_in_export: boolean;
  include_transcript: boolean;
  include_captions: boolean;
  include_raw_timing_manifest: boolean;
}

export const ASSEMBLY_CONFIG_KEY = 'assembly_config';
export const CAPTION_EXPORT_CONFIG_KEY = 'caption_config';
export const PACKAGE_EXPORT_CONFIG_KEY = 'package_config';

export const DEFAULT_ASSEMBLY_CONFIG: AssemblyConfig = {
  enable_scene_audio_assembly: true,
  duration_estimation_mode: 'wpm_based',
  fallback_on_missing_audio: 'use_placeholder',
  allow_partial_assembly: true,
  silence_gap_seconds: 0.5,
  target_wpm: 140,
};

export const DEFAULT_CAPTION_EXPORT_CONFIG: CaptionExportConfig = {
  caption_block_length_target_words: 12,
  split_long_narration: true,
  multiline_max_lines: 2,
  enabled_export_formats: ['json', 'srt', 'vtt'],
};

export const DEFAULT_PACKAGE_EXPORT_CONFIG: PackageExportConfig = {
  include_quality_summary: true,
  include_drift_summary: true,
  include_variants_in_export: true,
  include_transcript: true,
  include_captions: true,
  include_raw_timing_manifest: true,
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const JOB_EVENT_TYPES = {
  PROVIDER_RESOLVED: 'provider_resolved',
  SESSION_STARTED: 'session_started',
  AUTH_STARTED: 'auth_started',
  AUTH_SUCCEEDED: 'auth_succeeded',
  AUTH_FAILED: 'auth_failed',
  STEP_STARTED: 'step_started',
  STEP_COMPLETED: 'step_completed',
  STEP_FAILED: 'step_failed',
  STEP_SKIPPED: 'step_skipped',
  STEP_RETRIED: 'step_retried',
  SCREENSHOT_CAPTURED: 'screenshot_captured',
  VIDEO_RECORDING_STARTED: 'video_recording_started',
  VIDEO_FINALIZED: 'video_finalized',
  TRACE_STARTED: 'trace_started',
  TRACE_SAVED: 'trace_saved',
  WORKFLOW_COMPLETED: 'workflow_completed',
  WORKFLOW_FAILED: 'workflow_failed',
  CONTENT_GENERATION_STARTED: 'content_generation_started',
  CONTENT_GENERATION_COMPLETED: 'content_generation_completed',
  NARRATION_GENERATION_STARTED: 'narration_generation_started',
  NARRATION_GENERATION_COMPLETED: 'narration_generation_completed',
  SCENE_ASSEMBLY_STARTED: 'scene_assembly_started',
  SCENE_CREATED: 'scene_created',
  SCENE_ASSEMBLY_COMPLETED: 'scene_assembly_completed',
  NARRATION_SEGMENT_GENERATED: 'narration_segment_generated',
  PRONUNCIATION_RULES_APPLIED: 'pronunciation_rules_applied',
  CAPTIONS_BUILT: 'captions_built',
  QUALITY_SCORE_CALCULATED: 'quality_score_calculated',
  DRIFT_CHECK_COMPLETED: 'drift_check_completed',
  ROLE_VARIANT_GENERATED: 'role_variant_generated',
  JOB_CANCELLED: 'job_cancelled',
} as const;

export type JobEventType = (typeof JOB_EVENT_TYPES)[keyof typeof JOB_EVENT_TYPES];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  preparing: 'Preparing',
  running: 'Running',
  capturing: 'Capturing',
  scene_assembly: 'Assembling Scenes',
  generating_content: 'Generating Content',
  generating_narration: 'Generating Narration',
  quality_scoring: 'Scoring Quality',
  ready_for_review: 'Ready for Review',
  needs_manual_step: 'Needs Manual Step',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  'queued',
  'preparing',
  'running',
  'capturing',
  'scene_assembly',
  'generating_content',
  'generating_narration',
  'quality_scoring',
];

export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  'ready_for_review',
  'needs_manual_step',
  'completed',
  'failed',
  'cancelled',
];

export const SCREENSHOT_ROLE_LABELS: Record<ScreenshotRole, string> = {
  hero: 'Hero',
  context: 'Context',
  step: 'Step',
  recovery: 'Recovery',
  cover: 'Cover',
  validation: 'Validation',
  failure: 'Failure',
};

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  excellent: 'Excellent',
  good: 'Good',
  needs_review: 'Needs Review',
  needs_recapture: 'Needs Recapture',
  outdated: 'Outdated',
  incomplete: 'Incomplete',
};

export const DRIFT_STATUS_LABELS: Record<DriftStatus, string> = {
  current: 'Current',
  warning: 'Warning',
  outdated: 'Outdated',
  unknown: 'Unknown',
};

export const ROLE_VARIANT_LABELS: Record<TutorialRoleVariant, string> = {
  provider: 'Provider',
  billing: 'Billing',
  intake_staff: 'Intake Staff',
  scheduler: 'Scheduler',
  admin: 'Admin',
  executive: 'Executive',
  clinical_manager: 'Clinical Manager',
};

export const ASSEMBLY_STATUS_LABELS: Record<AssemblyStatus, string> = {
  not_started: 'Not Started',
  assembling_audio: 'Assembling Audio',
  assembling_captions: 'Assembling Captions',
  assembling_package: 'Assembling Package',
  assembled: 'Assembled',
  assembly_failed: 'Assembly Failed',
  partial: 'Partial Assembly',
};

export const ASSEMBLY_STATUS_COLORS: Record<AssemblyStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  assembling_audio: 'bg-blue-100 text-blue-700',
  assembling_captions: 'bg-cyan-100 text-cyan-700',
  assembling_package: 'bg-blue-100 text-blue-700',
  assembled: 'bg-green-100 text-green-700',
  assembly_failed: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
};

export const PACKAGE_EXPORT_TYPE_LABELS: Record<PackageExportType, string> = {
  json: 'JSON Export',
  package_json: 'Package JSON',
  timing_json: 'Timing Manifest',
  caption_json: 'Caption Manifest',
  scene_manifest: 'Scene Manifest',
  asset_manifest: 'Asset Manifest',
  narration_script: 'Narration Script',
  transcript: 'Transcript',
  quality_summary: 'Quality Summary',
  srt: 'SRT Captions',
  vtt: 'VTT Captions',
  zip_bundle: 'ZIP Bundle',
  render_manifest: 'Render Manifest',
};

export const SCENE_AUDIO_MAP_STATUS_LABELS: Record<SceneAudioMapStatus, string> = {
  pending: 'Pending',
  audio_ready: 'Audio Ready',
  captions_ready: 'Captions Ready',
  complete: 'Complete',
  missing_audio: 'Missing Audio',
  missing_transcript: 'Missing Transcript',
  error: 'Error',
};

export const SCENE_AUDIO_MAP_STATUS_COLORS: Record<SceneAudioMapStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  audio_ready: 'bg-blue-100 text-blue-700',
  captions_ready: 'bg-cyan-100 text-cyan-700',
  complete: 'bg-green-100 text-green-700',
  missing_audio: 'bg-amber-100 text-amber-700',
  missing_transcript: 'bg-orange-100 text-orange-700',
  error: 'bg-red-100 text-red-700',
};

// ─── Render Orchestration Types ───────────────────────────────────────────────

export type RenderProjectStatus =
  | 'not_started'
  | 'assembling_assets'
  | 'building_timeline'
  | 'ready_to_render'
  | 'rendering'
  | 'rendered'
  | 'render_failed';

export type RenderMode =
  | 'quick_preview'
  | 'standard_training'
  | 'detailed_walkthrough';

export type TimelineEventType =
  | 'video_segment'
  | 'screenshot_overlay'
  | 'narration_audio'
  | 'caption_display'
  | 'callout_display'
  | 'highlight_region'
  | 'zoom_effect'
  | 'transition';

export interface RenderVideoConfig {
  width: number;
  height: number;
  fps: number;
  codec: 'h264' | 'vp9' | 'av1';
  bitrate_kbps?: number;
}

export interface RenderCaptionConfig {
  enabled: boolean;
  format: 'srt' | 'vtt' | 'json';
  font_size: number;
  position: 'bottom' | 'top';
  burn_in?: boolean;
}

export interface RenderCalloutConfig {
  enabled: boolean;
  style: 'rounded' | 'pill' | 'box';
  animation: 'fade' | 'slide' | 'pop' | 'none';
  default_duration_ms?: number;
}

export interface RenderTransitionConfig {
  type: 'cut' | 'crossfade' | 'fade' | 'slide';
  duration_ms: number;
}

export interface RenderConfig {
  video: RenderVideoConfig;
  captions: RenderCaptionConfig;
  callouts: RenderCalloutConfig;
  transitions: RenderTransitionConfig;
}

export interface RenderProject {
  id: string;
  draft_id: string;
  organization_id: string;
  variant_id: string | null;
  render_status: RenderProjectStatus;
  render_mode: RenderMode;
  render_config_json: RenderConfig | Record<string, unknown>;
  total_duration_ms: number | null;
  render_manifest_json: RenderManifest | null;
  render_warnings_json: string[];
  scene_count: number | null;
  assembled_by: string | null;
  assembled_at: string | null;
  render_started_at: string | null;
  render_completed_at: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneRenderMetadata {
  id: string;
  render_project_id: string;
  scene_id: string;
  scene_order: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  zoom_region_json: { x: number; y: number; width: number; height: number } | null;
  highlight_region_json: { x: number; y: number; width: number; height: number } | null;
  callout_title: string | null;
  callout_description: string | null;
  callout_start_ms: number | null;
  callout_duration_ms: number | null;
  transition_in_type: string | null;
  transition_in_duration_ms: number | null;
  transition_out_type: string | null;
  transition_out_duration_ms: number | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VideoSegment {
  id: string;
  render_project_id: string;
  scene_id: string;
  segment_order: number;
  source_asset_id: string | null;
  source_start_ms: number;
  source_end_ms: number;
  output_start_ms: number;
  output_end_ms: number;
  playback_speed: number;
  has_zoom: boolean;
  has_highlight: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface ScreenshotOverlay {
  id: string;
  render_project_id: string;
  scene_id: string;
  asset_id: string;
  overlay_order: number;
  display_start_ms: number;
  display_end_ms: number;
  screenshot_role: ScreenshotRole;
  zoom_region_json: { x: number; y: number; width: number; height: number } | null;
  highlight_region_json: { x: number; y: number; width: number; height: number } | null;
  transition_type: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface RenderTimelineEvent {
  id: string;
  render_project_id: string;
  draft_id: string;
  scene_id: string | null;
  sort_order: number;
  event_type: TimelineEventType;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  payload_json: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

export interface RenderTimelineScene {
  scene_id: string;
  scene_order: number;
  title: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  video_segments: Array<{
    segment_order: number;
    source_asset_id: string | null;
    source_start_ms: number;
    source_end_ms: number;
    output_start_ms: number;
    output_end_ms: number;
    playback_speed: number;
    has_zoom: boolean;
    zoom_region: { x: number; y: number; width: number; height: number } | null;
    has_highlight: boolean;
    highlight_region: { x: number; y: number; width: number; height: number } | null;
  }>;
  screenshot_overlays: Array<{
    asset_id: string;
    file_url: string;
    screenshot_role: ScreenshotRole;
    display_start_ms: number;
    display_end_ms: number;
    zoom_region: { x: number; y: number; width: number; height: number } | null;
    highlight_region: { x: number; y: number; width: number; height: number } | null;
  }>;
  narration: {
    audio_asset_id: string | null;
    audio_url: string | null;
    start_ms: number;
    duration_ms: number;
    word_timings: Array<{ word: string; start_ms: number; end_ms: number }>;
  } | null;
  captions: Array<{
    text: string;
    start_ms: number;
    end_ms: number;
  }>;
  callout: {
    title: string;
    description: string | null;
    start_ms: number;
    duration_ms: number;
  } | null;
  zoom_effect: {
    region: { x: number; y: number; width: number; height: number };
    start_ms: number;
    duration_ms: number;
  } | null;
  highlight_effect: {
    region: { x: number; y: number; width: number; height: number };
    start_ms: number;
    duration_ms: number;
  } | null;
  transition_in: { type: string; duration_ms: number } | null;
  transition_out: { type: string; duration_ms: number } | null;
}

export interface RenderManifest {
  render_project_id: string;
  draft_id: string;
  draft_title: string;
  render_mode: RenderMode;
  render_config: RenderConfig;
  total_duration_ms: number;
  scene_count: number;
  scenes: RenderTimelineScene[];
  generated_at: string;
  schema_version: string;
  shot_plan_metadata?: {
    shot_plans_used: boolean;
    shot_count: number;
    scenes_with_shot_plans: number;
    scenes_without_shot_plans: number;
  };
}

export interface RenderReadinessCheck {
  has_scenes: boolean;
  has_narration_audio: boolean;
  has_captions: boolean;
  has_timing_manifest: boolean;
  scene_segmentation_complete: boolean;
  narration_coverage_pct: number;
  caption_coverage_pct: number;
  screenshot_coverage_pct: number;
  timing_integrity_ok: boolean;
  overall_ready: boolean;
  warnings: string[];
}

export interface RenderSettings {
  default_render_mode: RenderMode;
  default_video_config: RenderVideoConfig;
  default_caption_config: RenderCaptionConfig;
  default_callout_config: RenderCalloutConfig;
  default_transition_config: RenderTransitionConfig;
  auto_build_timeline_on_assembly: boolean;
  include_screenshot_overlays: boolean;
  narration_sync_enabled: boolean;
}

export const RENDER_SETTINGS_CONFIG_KEY = 'render_settings_config';

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  default_render_mode: 'standard_training',
  default_video_config: { width: 1920, height: 1080, fps: 30, codec: 'h264' },
  default_caption_config: { enabled: true, format: 'srt', font_size: 24, position: 'bottom' },
  default_callout_config: { enabled: true, style: 'rounded', animation: 'fade', default_duration_ms: 3000 },
  default_transition_config: { type: 'crossfade', duration_ms: 400 },
  auto_build_timeline_on_assembly: false,
  include_screenshot_overlays: true,
  narration_sync_enabled: true,
};

// ─── Render Job Types ─────────────────────────────────────────────────────────

export type RenderJobStatus =
  | 'queued'
  | 'preparing_assets'
  | 'validating_manifest'
  | 'rendering_timeline'
  | 'encoding_video'
  | 'generating_preview'
  | 'finalizing_assets'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RenderEngineProvider = 'mock' | 'ffmpeg' | 'remotion';

export type RenderArtifactType =
  | 'rendered_video'
  | 'render_preview'
  | 'render_thumbnail'
  | 'subtitle_srt'
  | 'subtitle_vtt'
  | 'render_log'
  | 'render_manifest_export'
  | 'render_package';

export type RenderJobEventType =
  | 'render_job_created'
  | 'manifest_validated'
  | 'assets_prepared'
  | 'scene_timeline_built'
  | 'audio_plan_built'
  | 'overlay_plan_built'
  | 'rendering_started'
  | 'encoding_started'
  | 'preview_generated'
  | 'thumbnail_generated'
  | 'subtitles_generated'
  | 'final_asset_saved'
  | 'render_completed'
  | 'render_failed'
  | 'render_cancelled'
  | 'render_progress'
  | 'warning_issued';

export interface RenderJob {
  id: string;
  draft_id: string;
  render_project_id: string | null;
  organization_id: string;
  engine_provider: RenderEngineProvider;
  render_mode: RenderMode;
  status: RenderJobStatus;
  progress_percent: number;
  current_step: string | null;
  settings_snapshot_json: RenderConfig | Record<string, unknown>;
  output_summary_json: RenderOutputSummary | null;
  error_message: string | null;
  warning_message: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface RenderJobEvent {
  id: string;
  render_job_id: string;
  event_type: RenderJobEventType;
  title: string;
  description: string | null;
  severity: JobEventSeverity;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface RenderJobArtifact {
  id: string;
  render_job_id: string;
  draft_id: string;
  artifact_type: RenderArtifactType;
  file_name: string;
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  is_mock: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface RenderOutputSummary {
  engine_provider: RenderEngineProvider;
  render_mode: RenderMode;
  total_duration_ms: number;
  output_resolution: string;
  fps: number;
  file_size_bytes: number;
  has_subtitles: boolean;
  has_preview: boolean;
  has_thumbnail: boolean;
  artifact_count: number;
  completed_at: string;
  is_mock: boolean;
}

export interface RenderEngineCapabilities {
  provider: RenderEngineProvider;
  label: string;
  available: boolean;
  supports_burn_in_captions: boolean;
  supports_zoom_effects: boolean;
  supports_callout_overlays: boolean;
  supports_preview_generation: boolean;
  supports_4k: boolean;
  estimated_speed_multiplier: number;
}

export const ACTIVE_RENDER_STATUSES: RenderJobStatus[] = [
  'queued',
  'preparing_assets',
  'validating_manifest',
  'rendering_timeline',
  'encoding_video',
  'generating_preview',
  'finalizing_assets',
];

export const TERMINAL_RENDER_STATUSES: RenderJobStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

export const RENDER_ENGINE_CAPABILITIES: Record<RenderEngineProvider, RenderEngineCapabilities> = {
  mock: {
    provider: 'mock',
    label: 'Mock Renderer',
    available: true,
    supports_burn_in_captions: true,
    supports_zoom_effects: true,
    supports_callout_overlays: true,
    supports_preview_generation: true,
    supports_4k: true,
    estimated_speed_multiplier: 100,
  },
  ffmpeg: {
    provider: 'ffmpeg',
    label: 'FFmpeg',
    available: true,
    supports_burn_in_captions: true,
    supports_zoom_effects: true,
    supports_callout_overlays: true,
    supports_preview_generation: true,
    supports_4k: true,
    estimated_speed_multiplier: 3,
  },
  remotion: {
    provider: 'remotion',
    label: 'Remotion',
    available: true,
    supports_burn_in_captions: true,
    supports_zoom_effects: true,
    supports_callout_overlays: true,
    supports_preview_generation: true,
    supports_4k: true,
    estimated_speed_multiplier: 2,
  },
};

export const RENDER_JOB_STATUS_LABELS: Record<RenderJobStatus, string> = {
  queued: 'Queued',
  preparing_assets: 'Preparing Assets',
  validating_manifest: 'Validating Manifest',
  rendering_timeline: 'Rendering Timeline',
  encoding_video: 'Encoding Video',
  generating_preview: 'Generating Preview',
  finalizing_assets: 'Finalizing Assets',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const RENDER_JOB_STATUS_COLORS: Record<RenderJobStatus, string> = {
  queued: 'bg-slate-100 text-slate-600',
  preparing_assets: 'bg-blue-100 text-blue-700',
  validating_manifest: 'bg-cyan-100 text-cyan-700',
  rendering_timeline: 'bg-sky-100 text-sky-700',
  encoding_video: 'bg-violet-100 text-violet-700',
  generating_preview: 'bg-blue-100 text-blue-700',
  finalizing_assets: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const RENDER_ARTIFACT_LABELS: Record<RenderArtifactType, string> = {
  rendered_video: 'Rendered Video',
  render_preview: 'Preview Clip',
  render_thumbnail: 'Thumbnail',
  subtitle_srt: 'SRT Subtitles',
  subtitle_vtt: 'VTT Subtitles',
  render_log: 'Render Log',
  render_manifest_export: 'Render Manifest',
  render_package: 'Full Package',
};

export const RENDER_ENGINE_LABELS: Record<RenderEngineProvider, string> = {
  mock: 'Mock Renderer',
  ffmpeg: 'FFmpeg',
  remotion: 'Remotion',
};

export const RENDER_PROJECT_STATUS_LABELS: Record<RenderProjectStatus, string> = {
  not_started: 'Not Started',
  assembling_assets: 'Assembling Assets',
  building_timeline: 'Building Timeline',
  ready_to_render: 'Ready to Render',
  rendering: 'Rendering',
  rendered: 'Rendered',
  render_failed: 'Render Failed',
};

export const RENDER_PROJECT_STATUS_COLORS: Record<RenderProjectStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  assembling_assets: 'bg-blue-100 text-blue-700',
  building_timeline: 'bg-cyan-100 text-cyan-700',
  ready_to_render: 'bg-blue-100 text-blue-700',
  rendering: 'bg-violet-100 text-violet-700',
  rendered: 'bg-green-100 text-green-700',
  render_failed: 'bg-red-100 text-red-700',
};

export const RENDER_MODE_LABELS: Record<RenderMode, string> = {
  quick_preview: 'Quick Preview',
  standard_training: 'Standard Training',
  detailed_walkthrough: 'Detailed Walkthrough',
};

export const RENDER_MODE_DESCRIPTIONS: Record<RenderMode, string> = {
  quick_preview: 'Fast pacing, fewer screenshots, no callouts. Best for internal review.',
  standard_training: 'Balanced pacing with screenshots, captions, and callouts. Default training video.',
  detailed_walkthrough: 'Slower pacing, full captions, detailed callouts. Best for onboarding.',
};

// ─── Shot Planning Types ──────────────────────────────────────────────────────

export type ShotType =
  | 'full_screen'
  | 'focused_crop'
  | 'zoom_highlight'
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'highlight'
  | 'callout'
  | 'split_screen'
  | 'animated_cursor'
  | 'transition_only'
  | 'screenshot_overlay'
  | 'split_emphasis'
  | 'confirmation_focus'
  | 'error_focus'
  | 'comparison_shot'
  | 'intro_cover'
  | 'outro_summary';

export type ShotPurpose =
  | 'explain_navigation'
  | 'explain_data_entry'
  | 'explain_confirmation'
  | 'explain_validation'
  | 'explain_error_recovery'
  | 'explain_result'
  | 'explain_best_practice'
  | 'explain_warning'
  | 'explain_role_specific_context';

export type ShotSourceType = 'screenshot' | 'video_clip' | 'synthetic' | 'hero_frame';

export type CameraMode = 'static' | 'pan' | 'zoom_in' | 'zoom_out' | 'follow_cursor';

export type CropMode = 'none' | 'custom' | 'auto_subject' | 'thirds_rule';

export type CalloutStyle = 'minimal' | 'standard' | 'rich' | 'warning' | 'error';

export type PointerStyle = 'none' | 'arrow' | 'circle' | 'spotlight' | 'trail';

export type ShotEmphasisLevel = 'low' | 'normal' | 'high' | 'critical';

export type ShotPacingMode = 'fixed_duration' | 'narration_synced' | 'auto' | 'manual';

export type ShotTransition =
  | 'cut'
  | 'crossfade'
  | 'fade_from_black'
  | 'fade_to_black'
  | 'slide_left'
  | 'slide_right'
  | 'wipe'
  | 'zoom_in'
  | 'zoom_out'
  | 'none';

export type OverlayPosition =
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'center'
  | 'custom';

export interface BoundingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PointerPathPoint {
  x: number;
  y: number;
  t_ms: number;
}

export interface DocumentationShotPlan {
  id: string;
  draft_id: string;
  scene_id: string | null;
  shot_order: number;
  shot_title?: string;
  title: string;
  shot_type: ShotType;
  purpose: ShotPurpose;
  source_type: ShotSourceType;
  source_asset_id: string | null;
  start_time_seconds: number;
  end_time_seconds: number;
  duration_seconds?: number;
  camera_mode: CameraMode;
  crop_mode: CropMode;
  zoom_region_json: BoundingRegion | null;
  highlight_region_json: BoundingRegion | null;
  callout_title: string | null;
  callout_description: string | null;
  callout_style: CalloutStyle;
  callout_start_time: number | null;
  callout_end_time: number | null;
  pointer_style: PointerStyle;
  pointer_path_json: PointerPathPoint[] | null;
  overlay_asset_id: string | null;
  overlay_position: OverlayPosition;
  overlay_start_time: number | null;
  overlay_end_time: number | null;
  emphasis_level: ShotEmphasisLevel;
  pacing_mode: ShotPacingMode;
  transition_in: ShotTransition;
  transition_out: ShotTransition;
  transition_duration: number;
  is_key_shot: boolean;
  notes: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  full_screen: 'Full Screen',
  focused_crop: 'Focused Crop',
  zoom_highlight: 'Zoom Highlight',
  zoom_in: 'Zoom In',
  zoom_out: 'Zoom Out',
  pan_left: 'Pan Left',
  pan_right: 'Pan Right',
  highlight: 'Highlight',
  callout: 'Callout',
  split_screen: 'Split Screen',
  animated_cursor: 'Animated Cursor',
  transition_only: 'Transition Only',
  screenshot_overlay: 'Screenshot Overlay',
  split_emphasis: 'Split Emphasis',
  confirmation_focus: 'Confirmation Focus',
  error_focus: 'Error Focus',
  comparison_shot: 'Comparison Shot',
  intro_cover: 'Intro Cover',
  outro_summary: 'Outro Summary',
};

export const SHOT_PURPOSE_LABELS: Record<ShotPurpose, string> = {
  explain_navigation: 'Explain Navigation',
  explain_data_entry: 'Explain Data Entry',
  explain_confirmation: 'Explain Confirmation',
  explain_validation: 'Explain Validation',
  explain_error_recovery: 'Explain Error Recovery',
  explain_result: 'Explain Result',
  explain_best_practice: 'Explain Best Practice',
  explain_warning: 'Explain Warning',
  explain_role_specific_context: 'Role-Specific Context',
};

export const SHOT_TYPE_COLORS: Record<ShotType, string> = {
  full_screen: 'bg-slate-100 text-slate-700',
  focused_crop: 'bg-blue-100 text-blue-700',
  zoom_highlight: 'bg-cyan-100 text-cyan-700',
  zoom_in: 'bg-cyan-50 text-cyan-600',
  zoom_out: 'bg-cyan-50 text-cyan-600',
  pan_left: 'bg-indigo-50 text-indigo-600',
  pan_right: 'bg-indigo-50 text-indigo-600',
  highlight: 'bg-yellow-100 text-yellow-700',
  callout: 'bg-purple-100 text-purple-700',
  split_screen: 'bg-sky-50 text-sky-600',
  animated_cursor: 'bg-teal-50 text-teal-600',
  transition_only: 'bg-gray-50 text-gray-500',
  screenshot_overlay: 'bg-blue-100 text-blue-700',
  split_emphasis: 'bg-sky-100 text-sky-700',
  confirmation_focus: 'bg-green-100 text-green-700',
  error_focus: 'bg-red-100 text-red-700',
  comparison_shot: 'bg-orange-100 text-orange-700',
  intro_cover: 'bg-emerald-100 text-emerald-700',
  outro_summary: 'bg-violet-100 text-violet-700',
};

export const SHOT_EMPHASIS_COLORS: Record<ShotEmphasisLevel, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export const SHOT_PACING_LABELS: Record<ShotPacingMode, string> = {
  fixed_duration: 'Fixed Duration',
  narration_synced: 'Narration Synced',
  auto: 'Auto',
  manual: 'Manual',
};

export const SHOT_PLANNING_CONFIG_KEY = 'shot_planning_config';

export interface ShotPlanningConfig {
  auto_generate_on_scene_creation: boolean;
  default_shot_type: ShotType;
  default_pacing_mode: ShotPacingMode;
  default_transition_in: ShotTransition;
  default_transition_out: ShotTransition;
  default_transition_duration: number;
  default_emphasis_level: ShotEmphasisLevel;
  enable_key_shot_tagging: boolean;
  min_shots_per_scene: number;
  max_shots_per_scene: number;
}

export const DEFAULT_SHOT_PLANNING_CONFIG: ShotPlanningConfig = {
  auto_generate_on_scene_creation: false,
  default_shot_type: 'full_screen',
  default_pacing_mode: 'narration_synced',
  default_transition_in: 'cut',
  default_transition_out: 'cut',
  default_transition_duration: 0.5,
  default_emphasis_level: 'normal',
  enable_key_shot_tagging: true,
  min_shots_per_scene: 1,
  max_shots_per_scene: 8,
};

// ─── Tutorial Integrity Types ─────────────────────────────────────────────────

export type IntegrityStatus =
  | 'unknown'
  | 'healthy'
  | 'warning'
  | 'needs_review'
  | 'needs_recapture'
  | 'outdated'
  | 'incomplete'
  | 'failed_validation';

export type IntegrityCategory =
  | 'capture'
  | 'content'
  | 'narration'
  | 'screenshot'
  | 'scene'
  | 'shot_plan'
  | 'caption'
  | 'render'
  | 'drift';

export type ValidationCheckStatus = 'pass' | 'warning' | 'fail' | 'skipped';

export type RevalidationEventType =
  | 'integrity_check_started'
  | 'integrity_check_completed'
  | 'integrity_warning_raised'
  | 'integrity_failure_raised'
  | 'tutorial_marked_validated'
  | 'tutorial_marked_outdated'
  | 'revalidation_requested'
  | 'recapture_requested'
  | 'shot_plan_generated'
  | 'shot_plan_updated'
  | 'drift_detected'
  | 'drift_resolved';

export type RevalidationOutcome = 'success' | 'failure' | 'pending' | 'skipped';

export interface IntegrityWarning {
  code: string;
  category: IntegrityCategory;
  message: string;
  field?: string;
  scene_id?: string;
  asset_id?: string;
}

export interface IntegrityFailure {
  code: string;
  category: IntegrityCategory;
  message: string;
  blocking: boolean;
  field?: string;
  scene_id?: string;
  asset_id?: string;
}

export interface IntegrityRecommendation {
  priority: 'low' | 'medium' | 'high';
  category: IntegrityCategory;
  action: string;
  detail?: string;
}

export interface TutorialIntegrityReport {
  id: string;
  draft_id: string;
  overall_status: IntegrityStatus;
  overall_score: number;
  capture_integrity_score: number | null;
  content_integrity_score: number | null;
  narration_integrity_score: number | null;
  screenshot_integrity_score: number | null;
  scene_integrity_score: number | null;
  shot_plan_integrity_score: number | null;
  caption_integrity_score: number | null;
  render_integrity_score: number | null;
  drift_integrity_score: number | null;
  warnings_json: IntegrityWarning[];
  failures_json: IntegrityFailure[];
  recommendations_json: IntegrityRecommendation[];
  checked_by: string | null;
  last_checked_at: string;
  check_duration_ms: number | null;
  engine_version: string;
  created_at: string;
  updated_at: string;
}

export interface RevalidationEvent {
  id: string;
  draft_id: string;
  event_type: RevalidationEventType;
  triggered_by: string | null;
  notes: string | null;
  outcome: RevalidationOutcome | null;
  detail_json: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
}

export interface ValidationHistoryEntry {
  id: string;
  draft_id: string;
  report_id: string | null;
  category: IntegrityCategory;
  check_name: string;
  status: ValidationCheckStatus;
  score: number | null;
  detail: string | null;
  metadata_json: Record<string, unknown>;
  checked_at: string;
}

export interface IntegrityDashboardStats {
  total_drafts: number;
  healthy_count: number;
  warning_count: number;
  needs_review_count: number;
  needs_recapture_count: number;
  outdated_count: number;
  incomplete_count: number;
  unknown_count: number;
  failed_validation_count: number;
  avg_integrity_score: number | null;
  revalidation_required_count: number;
}

export const INTEGRITY_STATUS_LABELS: Record<IntegrityStatus, string> = {
  unknown: 'Unknown',
  healthy: 'Healthy',
  warning: 'Warning',
  needs_review: 'Needs Review',
  needs_recapture: 'Needs Recapture',
  outdated: 'Outdated',
  incomplete: 'Incomplete',
  failed_validation: 'Failed Validation',
};

export const INTEGRITY_STATUS_COLORS: Record<IntegrityStatus, string> = {
  unknown: 'bg-slate-100 text-slate-600',
  healthy: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  needs_review: 'bg-orange-100 text-orange-700',
  needs_recapture: 'bg-red-100 text-red-700',
  outdated: 'bg-rose-100 text-rose-700',
  incomplete: 'bg-yellow-100 text-yellow-700',
  failed_validation: 'bg-red-200 text-red-800',
};

export const INTEGRITY_STATUS_BADGE_COLORS: Record<IntegrityStatus, string> = {
  unknown: 'border-slate-200 text-slate-500',
  healthy: 'border-green-200 text-green-700',
  warning: 'border-amber-300 text-amber-700',
  needs_review: 'border-orange-300 text-orange-700',
  needs_recapture: 'border-red-300 text-red-700',
  outdated: 'border-rose-300 text-rose-700',
  incomplete: 'border-yellow-300 text-yellow-700',
  failed_validation: 'border-red-400 text-red-800',
};

export const INTEGRITY_CATEGORY_LABELS: Record<IntegrityCategory, string> = {
  capture: 'Capture',
  content: 'Content',
  narration: 'Narration',
  screenshot: 'Screenshots',
  scene: 'Scene Structure',
  shot_plan: 'Shot Plans',
  caption: 'Captions',
  render: 'Render Readiness',
  drift: 'Drift',
};

export const VALIDATION_CHECK_STATUS_LABELS: Record<ValidationCheckStatus, string> = {
  pass: 'Pass',
  warning: 'Warning',
  fail: 'Fail',
  skipped: 'Skipped',
};

export const VALIDATION_CHECK_STATUS_COLORS: Record<ValidationCheckStatus, string> = {
  pass: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  fail: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-500',
};

export const REVALIDATION_EVENT_TYPE_LABELS: Record<RevalidationEventType, string> = {
  integrity_check_started: 'Integrity Check Started',
  integrity_check_completed: 'Integrity Check Completed',
  integrity_warning_raised: 'Warning Raised',
  integrity_failure_raised: 'Failure Raised',
  tutorial_marked_validated: 'Marked as Validated',
  tutorial_marked_outdated: 'Marked as Outdated',
  revalidation_requested: 'Revalidation Requested',
  recapture_requested: 'Recapture Requested',
  shot_plan_generated: 'Shot Plan Generated',
  shot_plan_updated: 'Shot Plan Updated',
  drift_detected: 'Drift Detected',
  drift_resolved: 'Drift Resolved',
};

export const INTEGRITY_RULES_CONFIG_KEY = 'integrity_rules_config';

export interface IntegrityRulesConfig {
  require_all_scenes_have_shots: boolean;
  require_narration_for_all_scenes: boolean;
  require_captions_for_all_scenes: boolean;
  require_hero_screenshot_per_scene: boolean;
  min_scene_count: number;
  max_acceptable_drift_days: number;
  min_overall_score_for_healthy: number;
  min_overall_score_for_warning: number;
  auto_run_on_job_complete: boolean;
  fail_on_missing_shot_plans: boolean;
  fail_on_missing_captions: boolean;
  fail_on_outdated_drift: boolean;
  engine_version: string;
}

export const DEFAULT_INTEGRITY_RULES_CONFIG: IntegrityRulesConfig = {
  require_all_scenes_have_shots: false,
  require_narration_for_all_scenes: false,
  require_captions_for_all_scenes: false,
  require_hero_screenshot_per_scene: false,
  min_scene_count: 1,
  max_acceptable_drift_days: 90,
  min_overall_score_for_healthy: 80,
  min_overall_score_for_warning: 60,
  auto_run_on_job_complete: false,
  fail_on_missing_shot_plans: false,
  fail_on_missing_captions: false,
  fail_on_outdated_drift: false,
  engine_version: '1.0.0',
};

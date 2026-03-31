export type JobStatus =
  | 'queued'
  | 'preparing'
  | 'running'
  | 'capturing'
  | 'generating_content'
  | 'scene_assembly'
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

export interface WorkflowStepData {
  id: string;
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
  is_scene_break?: boolean;
}

export interface WorkflowData {
  id: string;
  name: string;
  start_url: string;
  success_url_pattern: string | null;
  requires_auth: boolean;
  uses_demo_account: boolean;
  steps: WorkflowStepData[];
}

export interface DemoAccountData {
  id: string;
  name: string;
  environment: string;
  base_url: string;
  login_path: string;
  login_selectors: {
    username: string;
    password: string;
    submit: string;
    successUrlPattern: string;
  };
  env_password_key: string;
}

export interface PlaywrightConfig {
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

export interface RunRequest {
  job_id: string;
  workflow: WorkflowData;
  demo_account: DemoAccountData | null;
  settings: PlaywrightConfig;
  callback_url: string;
  /** Supabase anon (or service) key for Storage/API — prefer `supabase_anon_key` in new clients. */
  callback_token: string;
  supabase_service_role_key: string;
}

export interface RetryAttemptLog {
  attempt: number;
  error: string;
  selector_tried: string;
  strategy_tried: string;
  duration_ms: number;
  failure_screenshot_asset_id?: string;
}

export type ScreenshotRoleHint = 'hero' | 'step' | 'failure' | 'cover';

export interface StepExecutionResult {
  step_id: string;
  step_order: number;
  title: string;
  action_type: string;
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
  is_navigation?: boolean;
  is_form_submit?: boolean;
  is_scene_break?: boolean;
  url_after?: string;
  screenshot_role_hint?: ScreenshotRoleHint;
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

export interface JobEvent {
  event_type: string;
  title: string;
  description?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  payload_json: Record<string, unknown>;
  step_id?: string;
  step_order?: number;
  duration_ms?: number;
  created_at: string;
}

export interface RunnerCallbackPayload {
  action: 'runner_callback';
  job_id: string;
  status: string;
  step_results: StepExecutionResult[];
  execution_summary: RichExecutionSummary | Record<string, unknown>;
  error_message?: string;
  asset_count: number;
  events: JobEvent[];
  completed_step_count?: number;
}

export interface UploadScreenshotParams {
  jobId: string;
  stepId: string;
  stepOrder: number;
  caption: string;
  buffer: Buffer;
  assetType?: 'screenshot' | 'failure_screenshot';
  isCover?: boolean;
}

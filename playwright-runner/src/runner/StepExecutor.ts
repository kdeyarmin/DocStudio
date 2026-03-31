import type { Page } from 'playwright';
import type {
  WorkflowStepData,
  StepExecutionResult,
  PlaywrightConfig,
  RetryAttemptLog,
} from '../types';
import { ActionHandlers } from './ActionHandlers';
import { ScreenshotHandler } from './ScreenshotHandler';
import { AssetUploader } from './AssetUploader';
import { assertNavigationTargetIfAbsolute } from '../navigationUrl';

const NAVIGATION_ACTIONS = new Set(['visit_url']);
const SUBMIT_SELECTOR_PATTERN = /submit|btn-submit|button\[type="submit"\]|input\[type="submit"\]/i;

const BASE_BACKOFF_MS = 600;
const MAX_BACKOFF_MS = 8000;
const JITTER_RATIO = 0.3;

function backoffMs(attempt: number): number {
  const exp = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
  const jitter = exp * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.round(exp + jitter);
}

export class StepExecutor {
  private actionHandlers: ActionHandlers;
  private screenshotHandler: ScreenshotHandler;

  constructor(
    private page: Page,
    private settings: PlaywrightConfig,
    private uploader: AssetUploader,
    private jobId: string,
    private allowedNavOrigins: ReadonlySet<string>,
    private navigationBaseUrl: string,
  ) {
    this.actionHandlers = new ActionHandlers(
      page,
      settings,
      allowedNavOrigins,
      navigationBaseUrl,
    );
    this.screenshotHandler = new ScreenshotHandler(page);
  }

  async executeStep(step: WorkflowStepData): Promise<StepExecutionResult> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    const maxRetries =
      step.error_handling_strategy === 'retry' ? Math.max(0, step.retry_count || 2) : 0;

    let retryAttempts = 0;
    let lastError: string | undefined;
    let extractedText: string | undefined;
    let screenshotAssetId: string | undefined;
    let selectorUsed: string = step.target_selector;
    let selectorStrategyUsed: string = step.selector_strategy;
    let usedFallback = false;
    const retryLog: RetryAttemptLog[] = [];

    const stepTimeout = step.timeout_seconds > 0
      ? step.timeout_seconds * 1000
      : this.settings.step_timeout_ms || 30000;

    this.page.setDefaultTimeout(stepTimeout);

    while (retryAttempts <= maxRetries) {
      const attemptStart = Date.now();
      try {
        try {
          assertNavigationTargetIfAbsolute(step.target_selector, this.allowedNavOrigins);
          if (step.action_value) {
            assertNavigationTargetIfAbsolute(step.action_value, this.allowedNavOrigins);
          }
        } catch (navErr) {
          throw new Error(
            navErr instanceof Error ? navErr.message : 'Navigation URL not allowed',
          );
        }
        const result = await this.actionHandlers.execute(step);

        if (result.extractedText !== undefined) extractedText = result.extractedText;
        if (result.selectorUsed) selectorUsed = result.selectorUsed;
        if (result.selectorStrategyUsed) selectorStrategyUsed = result.selectorStrategyUsed;
        if (result.usedFallback) usedFallback = true;

        if (step.screenshot_checkpoint && this.settings.screenshots_enabled !== false) {
          const caption = step.screenshot_caption_template || step.title;
          const buffer = await this.screenshotHandler.capture();
          if (buffer) {
            screenshotAssetId =
              (await this.uploader.uploadScreenshot({
                jobId: this.jobId,
                stepId: step.id,
                stepOrder: step.step_order,
                caption,
                buffer,
                assetType: 'screenshot',
              })) ?? undefined;
          }
        }

        const urlAfter = this.safeGetUrl();
        const isNavigation = NAVIGATION_ACTIONS.has(step.action_type);
        const isFormSubmit =
          step.action_type === 'conditional_branch' ||
          (step.action_type === 'click' && SUBMIT_SELECTOR_PATTERN.test(step.target_selector ?? ''));

        return {
          step_id: step.id,
          step_order: step.step_order,
          title: step.title,
          action_type: step.action_type,
          status: 'success',
          duration_ms: Date.now() - startMs,
          retry_attempts: retryAttempts,
          used_fallback: usedFallback,
          extracted_text: extractedText,
          screenshot_asset_id: screenshotAssetId,
          selector_used: selectorUsed,
          selector_strategy_used: selectorStrategyUsed,
          retry_log: retryLog.length > 0 ? retryLog : undefined,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          is_navigation: isNavigation,
          is_form_submit: isFormSubmit,
          is_scene_break: step.is_scene_break ?? false,
          url_after: urlAfter,
        };
      } catch (err) {
        const attemptDurationMs = Date.now() - attemptStart;
        lastError = err instanceof Error ? err.message : String(err);

        const failureScreenshotId = await this.captureFailureScreenshot(
          step,
          retryAttempts + 1,
        );

        retryLog.push({
          attempt: retryAttempts + 1,
          error: lastError,
          selector_tried: selectorUsed,
          strategy_tried: selectorStrategyUsed,
          duration_ms: attemptDurationMs,
          failure_screenshot_asset_id: failureScreenshotId ?? undefined,
        });

        if (retryAttempts < maxRetries) {
          retryAttempts++;
          const delay = backoffMs(retryAttempts);
          console.warn(
            `[StepExecutor] step ${step.step_order} attempt ${retryAttempts}/${maxRetries} ` +
            `failed (${lastError.slice(0, 120)}), retrying in ${delay}ms`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    const sharedEnrichment = {
      is_navigation: NAVIGATION_ACTIONS.has(step.action_type),
      is_form_submit:
        step.action_type === 'conditional_branch' ||
        (step.action_type === 'click' && SUBMIT_SELECTOR_PATTERN.test(step.target_selector ?? '')),
      is_scene_break: step.is_scene_break ?? false,
      url_after: this.safeGetUrl(),
    };

    if (
      step.is_optional ||
      step.error_handling_strategy === 'skip' ||
      step.error_handling_strategy === 'fallback_to_manual_step'
    ) {
      const reason =
        step.error_handling_strategy === 'fallback_to_manual_step'
          ? 'manual fallback'
          : 'optional';
      console.warn(`[StepExecutor] step ${step.step_order} skipped (${reason}): ${lastError}`);
      return {
        step_id: step.id,
        step_order: step.step_order,
        title: step.title,
        action_type: step.action_type,
        status: 'skipped',
        duration_ms: durationMs,
        retry_attempts: retryAttempts,
        used_fallback: usedFallback,
        error: lastError,
        selector_used: selectorUsed,
        selector_strategy_used: selectorStrategyUsed,
        retry_log: retryLog.length > 0 ? retryLog : undefined,
        started_at: startedAt,
        completed_at: completedAt,
        ...sharedEnrichment,
      };
    }

    console.error(`[StepExecutor] step ${step.step_order} failed after ${retryAttempts} retries: ${lastError}`);
    return {
      step_id: step.id,
      step_order: step.step_order,
      title: step.title,
      action_type: step.action_type,
      status: 'failed',
      duration_ms: durationMs,
      retry_attempts: retryAttempts,
      used_fallback: usedFallback,
      error: lastError,
      selector_used: selectorUsed,
      selector_strategy_used: selectorStrategyUsed,
      retry_log: retryLog.length > 0 ? retryLog : undefined,
      started_at: startedAt,
      completed_at: completedAt,
      ...sharedEnrichment,
    };
  }

  private safeGetUrl(): string | undefined {
    try {
      return this.page.url();
    } catch {
      return undefined;
    }
  }

  private async captureFailureScreenshot(
    step: WorkflowStepData,
    attemptNumber: number,
  ): Promise<string | null> {
    if (this.settings.screenshots_enabled === false) return null;
    if (!this.settings.retain_partial_assets_on_failure) return null;

    try {
      const buffer = await this.screenshotHandler.capture();
      if (!buffer) return null;

      return await this.uploader.uploadScreenshot({
        jobId: this.jobId,
        stepId: step.id,
        stepOrder: step.step_order,
        caption: `Failure on step ${step.step_order} (attempt ${attemptNumber}): ${step.title}`,
        buffer,
        assetType: 'failure_screenshot',
        isCover: false,
      });
    } catch (err) {
      console.warn(`[StepExecutor] failure screenshot capture failed:`, err);
      return null;
    }
  }
}

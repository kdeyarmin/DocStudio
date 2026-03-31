import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import type {
  RunRequest,
  StepExecutionResult,
  JobEvent,
  RunnerCallbackPayload,
  RichExecutionSummary,
  StepTiming,
} from '../types';
import { StepExecutor } from './StepExecutor';
import { AssetUploader } from './AssetUploader';
import type { NavigationPolicy } from './ActionHandlers';
import {
  assertAllowedNavigationUrl,
  buildAllowedNavigationOrigins,
  resolveDemoPasswordEnvKey,
} from '../navigationUrl';

const PROGRESS_PING_INTERVAL_STEPS = 3;

function shouldStopWorkflowOnFailure(strategy: RunRequest['workflow']['steps'][number]['error_handling_strategy']): boolean {
  return strategy === 'fail' || strategy === 'fallback_to_manual_step';
}

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('A trusted playwright base URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid trusted base URL: ${trimmed}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Trusted base URL must use http or https: ${trimmed}`);
  }

  return parsed.toString().replace(/\/$/, '');
}

export function buildNavigationPolicy(request: RunRequest): NavigationPolicy {
  const configuredOrigins = [
    process.env.PLAYWRIGHT_ALLOWED_ORIGINS,
    process.env.PLAYWRIGHT_BASE_URL,
    process.env.SUPABASE_URL,
    request.settings.playwright_base_url,
    request.demo_account?.base_url ?? '',
  ]
    .flatMap((value) => (value ?? '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedOrigins = new Set(
    configuredOrigins
      .map((value) => toOrigin(value))
      .filter((value): value is string => Boolean(value)),
  );

  const trustedBaseUrl = normalizeBaseUrl(
    request.demo_account?.base_url || request.settings.playwright_base_url || '',
  );

  const trustedBaseOrigin = new URL(trustedBaseUrl).origin;
  allowedOrigins.add(trustedBaseOrigin);

  return {
    resolveUrl(rawUrl: string): string {
      const trimmed = rawUrl.trim();
      if (!trimmed) {
        throw new Error('Navigation target cannot be empty');
      }

      const resolved = new URL(trimmed, `${trustedBaseUrl}/`);
      if (!allowedOrigins.has(resolved.origin)) {
        throw new Error(
          `Navigation target origin "${resolved.origin}" is not allowed`,
        );
      }

      if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
        throw new Error(
          `Navigation target must use http or https: ${resolved.toString()}`,
        );
      }

      return resolved.toString();
    },
  };
}

export class WorkflowRunner {
  private cancelled = false;
  private browser: Browser | null = null;
  private stepResults: StepExecutionResult[] = [];
  private events: JobEvent[] = [];
  private newEventsSinceLastPing: JobEvent[] = [];
  private assetCount = 0;
  private failureScreenshotCount = 0;
  private lastPingAt = 0;
  private firstScreenshotSeen = false;

  constructor(private request: RunRequest) {}

  cancel(): void {
    this.cancelled = true;
  }

  private addEvent(event: Omit<JobEvent, 'created_at'>): void {
    const full = { ...event, created_at: new Date().toISOString() };
    this.events.push(full);
    this.newEventsSinceLastPing.push(full);
  }

  async run(): Promise<void> {
    const {
      job_id,
      workflow,
      demo_account,
      settings,
      callback_url,
      callback_token,
    } = this.request;
    const startMs = Date.now();
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    let finalStatus: string = 'failed';
    let errorMessage: string | undefined;
    let page: Page | null = null;
    let context: BrowserContext | null = null;
    let authDurationMs = 0;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for asset uploads');
    }

    const allowedNavOrigins = buildAllowedNavigationOrigins();

    const supabase = createClient(supabaseUrl, callback_token);

    const uploader = new AssetUploader(supabase);

    /** When true, skip the terminal success path (ready_for_review) after the step loop. */
    let blockSuccessCompletion = false;

    try {
      await this.postStatusUpdate(callback_url, callback_token, job_id, 'preparing');

      this.addEvent({
        event_type: 'session_started',
        title: 'Browser Session Starting',
        description: 'Launching Chromium browser.',
        severity: 'info',
        payload_json: { headless: settings.headless !== false },
      });

      this.browser = await chromium.launch({ headless: settings.headless !== false });

      const viewport = {
        width: settings.viewport_width || 1280,
        height: settings.viewport_height || 800,
      };

      context = await this.browser.newContext({
        viewport,
        recordVideo: settings.video_enabled
          ? { dir: '/tmp/doc-studio-videos/', size: viewport }
          : undefined,
      });

      page = await context.newPage();
      page.setDefaultTimeout(settings.step_timeout_ms || 30000);
      page.setDefaultNavigationTimeout(settings.navigation_timeout_ms || 30000);

      const authNeeded = workflow.requires_auth || workflow.uses_demo_account;

      if (authNeeded) {
        const authStartMs = Date.now();

        this.addEvent({
          event_type: 'auth_started',
          title: 'Authentication Starting',
          description: 'Navigating to login page.',
          severity: 'info',
          payload_json: {},
        });
        await this.postStatusUpdate(callback_url, callback_token, job_id, 'running');

        const baseUrlRaw = demo_account?.base_url || settings.playwright_base_url || '';
        if (!baseUrlRaw.trim()) {
          throw new Error(
            'playwright_base_url or demo_account.base_url is required when authentication is enabled',
          );
        }
        const baseUrl = assertAllowedNavigationUrl(baseUrlRaw, allowedNavOrigins);
        const loginPath =
          demo_account?.login_path || settings.playwright_login_path || '/login';
        const userSel =
          demo_account?.login_selectors?.username ||
          settings.playwright_username_selector ||
          'input[type="email"]';
        const passSel =
          demo_account?.login_selectors?.password ||
          settings.playwright_password_selector ||
          'input[type="password"]';
        const submitSel =
          demo_account?.login_selectors?.submit ||
          settings.playwright_submit_selector ||
          'button[type="submit"]';
        const successPattern =
          demo_account?.login_selectors?.successUrlPattern ||
          settings.playwright_success_url_pattern ||
          '/dashboard';

        const username = process.env.DEMO_ACCOUNT_USERNAME ?? '';
        const passwordKey = resolveDemoPasswordEnvKey(demo_account?.env_password_key);
        const password = process.env[passwordKey] ?? '';

        if (!username || !password) {
          throw new Error(
            `Demo account credentials missing: DEMO_ACCOUNT_USERNAME=${username ? 'set' : 'NOT SET'}, ${passwordKey}=${password ? 'set' : 'NOT SET'}`,
          );
        }

        const loginUrl = new URL(loginPath, baseUrl).toString();
        await page.goto(loginUrl, {
          waitUntil: 'networkidle',
          timeout: settings.navigation_timeout_ms || 30000,
        });
        await page.fill(userSel, username);
        await page.fill(passSel, password);
        await page.click(submitSel);
        await page.waitForURL(
          (url: URL) => url.pathname.includes(successPattern) || url.href.includes(successPattern),
          { timeout: 20000 },
        );

        authDurationMs = Date.now() - authStartMs;

        this.addEvent({
          event_type: 'auth_succeeded',
          title: 'Authentication Successful',
          description: `Logged in after ${authDurationMs}ms. Current URL: ${page.url()}`,
          severity: 'success',
          payload_json: { url: page.url(), auth_duration_ms: authDurationMs },
          duration_ms: authDurationMs,
        });
      } else {
        await this.postStatusUpdate(callback_url, callback_token, job_id, 'running');
      }

      const baseForStart =
        demo_account?.base_url || settings.playwright_base_url || '';
      let startUrl: string;
      const startRaw = workflow.start_url ?? '';
      if (/^https?:\/\//i.test(startRaw.trim())) {
        startUrl = assertAllowedNavigationUrl(startRaw, allowedNavOrigins);
      } else {
        if (!baseForStart.trim()) {
          throw new Error(
            'playwright_base_url or demo_account.base_url is required when workflow.start_url is relative',
          );
        }
        const baseResolved = assertAllowedNavigationUrl(baseForStart, allowedNavOrigins);
        try {
          startUrl = new URL(startRaw, baseResolved).href;
        } catch {
          throw new Error('Invalid workflow.start_url (could not resolve against base URL)');
        }
        assertAllowedNavigationUrl(startUrl, allowedNavOrigins);
      }

      const rawNavBase = (demo_account?.base_url || settings.playwright_base_url || '').trim();
      const navigationBaseUrl = rawNavBase
        ? assertAllowedNavigationUrl(rawNavBase, allowedNavOrigins)
        : new URL(startUrl).origin + '/';

      await page.goto(startUrl, {
        waitUntil: 'networkidle',
        timeout: settings.navigation_timeout_ms || 30000,
      });

      await this.postStatusUpdate(callback_url, callback_token, job_id, 'capturing');

      const executor = new StepExecutor(
        page,
        settings,
        uploader,
        job_id,
        allowedNavOrigins,
        navigationBaseUrl,
      );
      const steps = [...(workflow.steps ?? [])].sort((a, b) => a.step_order - b.step_order);

      for (const step of steps) {
        if (this.cancelled) {
          blockSuccessCompletion = true;
          finalStatus = 'cancelled';
          this.addEvent({
            event_type: 'job_cancelled',
            title: 'Job Cancelled',
            description: 'Run was cancelled during step execution.',
            severity: 'warning',
            payload_json: { at_step: step.step_order },
          });
          break;
        }

        this.addEvent({
          event_type: 'step_started',
          title: `Step ${step.step_order}: ${step.title}`,
          description: step.description ?? undefined,
          severity: 'info',
          payload_json: { action_type: step.action_type, selector: step.target_selector },
          step_id: step.id,
          step_order: step.step_order,
        });

        const rawResult = await executor.executeStep(step);

        const failureShots = rawResult.retry_log?.filter(
          (r) => r.failure_screenshot_asset_id
        ).length ?? 0;

        let screenshotRoleHint: StepExecutionResult['screenshot_role_hint'] = undefined;
        if (rawResult.screenshot_asset_id) {
          if (!this.firstScreenshotSeen) {
            screenshotRoleHint = 'cover';
            this.firstScreenshotSeen = true;
          } else {
            screenshotRoleHint = 'step';
          }
        } else if (failureShots > 0) {
          screenshotRoleHint = 'failure';
        }

        const result: StepExecutionResult = { ...rawResult, screenshot_role_hint: screenshotRoleHint };
        this.stepResults.push(result);

        if (result.screenshot_asset_id) this.assetCount++;
        this.failureScreenshotCount += failureShots;
        if (failureShots > 0) this.assetCount += failureShots;

        const resultSeverity =
          result.status === 'success'
            ? 'success'
            : result.status === 'skipped'
            ? 'warning'
            : 'error';

        this.addEvent({
          event_type: result.status === 'success' ? 'step_completed' : `step_${result.status}`,
          title: `Step ${step.step_order} ${result.status}`,
          description: result.error ?? `Completed in ${result.duration_ms}ms`,
          severity: resultSeverity as JobEvent['severity'],
          payload_json: {
            duration_ms: result.duration_ms,
            retry_attempts: result.retry_attempts,
            used_fallback: result.used_fallback,
            selector_used: result.selector_used,
            selector_strategy_used: result.selector_strategy_used,
          },
          step_id: step.id,
          step_order: step.step_order,
          duration_ms: result.duration_ms,
        });

        const shouldPing =
          this.stepResults.length % PROGRESS_PING_INTERVAL_STEPS === 0 ||
          result.status === 'failed';

        if (shouldPing) {
          await this.postProgressPing(callback_url, callback_token, job_id);
        }

        if (result.status === 'failed' && shouldStopWorkflowOnFailure(step.error_handling_strategy)) {
          blockSuccessCompletion = true;
          errorMessage = result.error ?? `Step ${step.step_order} failed`;
          finalStatus =
            step.error_handling_strategy === 'fallback_to_manual_step'
              ? 'needs_manual_step'
              : 'failed';
          this.addEvent({
            event_type: 'workflow_failed',
            title:
              step.error_handling_strategy === 'fallback_to_manual_step'
                ? 'Workflow Paused for Manual Steps'
                : 'Workflow Failed',
            description: errorMessage,
            severity:
              step.error_handling_strategy === 'fallback_to_manual_step' ? 'warning' : 'error',
            payload_json: { step_order: step.step_order },
          });
          break;
        }
      }

      if (!this.cancelled && !blockSuccessCompletion) {
        await this.postStatusUpdate(callback_url, callback_token, job_id, 'generating_content');
        this.addEvent({
          event_type: 'content_generation_started',
          title: 'Generating Documentation',
          description: 'Finalizing captured assets.',
          severity: 'info',
          payload_json: { asset_count: this.assetCount },
        });

        await new Promise((r) => setTimeout(r, 400));

        this.addEvent({
          event_type: 'content_generation_completed',
          title: 'Documentation Ready',
          description: `${this.assetCount} asset(s) captured across ${this.stepResults.length} steps.`,
          severity: 'success',
          payload_json: { asset_count: this.assetCount },
        });

        finalStatus = 'ready_for_review';
        this.addEvent({
          event_type: 'workflow_completed',
          title: 'Workflow Completed',
          description: `All steps finished in ${Math.round((Date.now() - startMs) / 1000)}s.`,
          severity: 'success',
          payload_json: { duration_ms: Date.now() - startMs },
        });
      }
    } catch (err) {
      blockSuccessCompletion = true;
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[WorkflowRunner] job ${job_id} crashed:`, errorMessage);
      finalStatus = 'failed';
      this.addEvent({
        event_type: 'workflow_failed',
        title: 'Workflow Error',
        description: errorMessage,
        severity: 'error',
        payload_json: {},
      });
    } finally {
      try {
        await context?.close();
      } catch { /* ignore */ }
      try {
        await this.browser?.close();
      } catch { /* ignore */ }
      this.browser = null;
    }

    const durationSeconds = Math.round((Date.now() - startMs) / 1000);
    const executionSummary = this.buildExecutionSummary(
      durationSeconds,
      authDurationMs,
    );

    const payload: RunnerCallbackPayload = {
      action: 'runner_callback',
      job_id,
      status: finalStatus,
      step_results: this.stepResults,
      execution_summary: executionSummary,
      error_message: errorMessage,
      asset_count: this.assetCount,
      events: this.events,
      completed_step_count: this.stepResults.filter((s) => s.status === 'success').length,
    };

    await this.postCallback(callback_url, callback_token, payload);
  }

  private buildExecutionSummary(
    durationSeconds: number,
    authDurationMs: number,
  ): RichExecutionSummary {
    const stepTimings: StepTiming[] = this.stepResults.map((r) => ({
      step_order: r.step_order,
      title: r.title,
      duration_ms: r.duration_ms,
      status: r.status === 'skipped' ? 'skipped' : r.status === 'failed' ? 'failed' : 'success',
    }));

    const timed = stepTimings.filter((t) => t.duration_ms > 0);
    const slowest = timed.length > 0
      ? timed.reduce((a, b) => (b.duration_ms > a.duration_ms ? b : a))
      : null;
    const fastest = timed.length > 0
      ? timed.reduce((a, b) => (b.duration_ms < a.duration_ms ? b : a))
      : null;

    const totalRetryCount = this.stepResults.reduce(
      (sum, r) => sum + (r.retry_attempts ?? 0),
      0,
    );
    const fallbackUsedCount = this.stepResults.filter((r) => r.used_fallback).length;

    return {
      total_steps: this.stepResults.length,
      successful_steps: this.stepResults.filter((s) => s.status === 'success').length,
      failed_steps: this.stepResults.filter((s) => s.status === 'failed').length,
      skipped_steps: this.stepResults.filter((s) => s.status === 'skipped').length,
      asset_count: this.assetCount,
      duration_seconds: durationSeconds,
      auth_duration_ms: authDurationMs,
      total_retry_count: totalRetryCount,
      fallback_used_count: fallbackUsedCount,
      failure_screenshot_count: this.failureScreenshotCount,
      step_timings: stepTimings,
      slowest_step: slowest,
      fastest_step: fastest,
    };
  }

  private async postStatusUpdate(
    callbackUrl: string,
    token: string,
    jobId: string,
    status: string,
  ): Promise<void> {
    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'runner_callback',
          job_id: jobId,
          status,
          step_results: this.stepResults,
          execution_summary: {},
          asset_count: this.assetCount,
          events: [],
          completed_step_count: this.stepResults.filter((s) => s.status === 'success').length,
        }),
      });
    } catch (err) {
      console.warn(`[WorkflowRunner] status update to "${status}" failed:`, err);
    }
  }

  private async postProgressPing(
    callbackUrl: string,
    token: string,
    jobId: string,
  ): Promise<void> {
    if (this.newEventsSinceLastPing.length === 0 && this.stepResults.length === this.lastPingAt) {
      return;
    }

    const flushedEvents = [...this.newEventsSinceLastPing];
    this.newEventsSinceLastPing = [];
    this.lastPingAt = this.stepResults.length;

    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'runner_callback',
          job_id: jobId,
          status: 'capturing',
          step_results: this.stepResults,
          execution_summary: {
            total_steps: this.stepResults.length,
            asset_count: this.assetCount,
          },
          asset_count: this.assetCount,
          events: flushedEvents,
          completed_step_count: this.stepResults.filter((s) => s.status === 'success').length,
        }),
      });
    } catch (err) {
      console.warn(`[WorkflowRunner] progress ping failed:`, err);
      this.newEventsSinceLastPing.unshift(...flushedEvents);
    }
  }

  private async postCallback(
    callbackUrl: string,
    token: string,
    payload: RunnerCallbackPayload,
  ): Promise<void> {
    try {
      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(
          `[WorkflowRunner] final callback failed (${res.status}): ${text}`
        );
      } else {
        console.log(
          `[WorkflowRunner] job ${payload.job_id} completed with status: ${payload.status}`
        );
      }
    } catch (err) {
      console.error('[WorkflowRunner] final callback threw:', err);
    }
  }
}

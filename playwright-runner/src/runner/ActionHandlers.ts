import type { Page, Locator } from 'playwright';
import type { WorkflowStepData, PlaywrightConfig } from '../types';
import { SelectorResolver } from './SelectorResolver';
import {
  assertAllowedNavigationUrl,
  assertNavigationTargetIfAbsolute,
  resolveAllowedUploadPath,
} from '../navigationUrl';


export interface ActionResult {
  extractedText?: string;
  selectorUsed?: string;
  selectorStrategyUsed?: string;
  usedFallback?: boolean;
}

export interface NavigationPolicy {
  resolveUrl(rawUrl: string): string;
}

export class ActionHandlers {
  private resolver: SelectorResolver;

  constructor(
    private page: Page,
    private settings: PlaywrightConfig,
    private allowedNavOrigins: ReadonlySet<string>,
    private navigationBaseUrl: string,
  ) {
    this.resolver = new SelectorResolver(page);
  }

  async execute(step: WorkflowStepData): Promise<ActionResult> {
    const { action_type, target_selector, action_value } = step;
    const actionTimeout = (step.timeout_seconds * 1000) || this.settings.action_timeout_ms || 10000;
    const navTimeout = this.settings.navigation_timeout_ms || 30000;

    switch (action_type) {
      case 'visit_url': {
        const raw = (action_value ?? target_selector ?? '').trim();
        if (!raw) {
          throw new Error('visit_url requires action_value or target_selector');
        }
        const url = /^https?:\/\//i.test(raw)
          ? assertAllowedNavigationUrl(raw, this.allowedNavOrigins)
          : assertAllowedNavigationUrl(new URL(raw, this.navigationBaseUrl).href, this.allowedNavOrigins);
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: navTimeout });
        return {};
      }

      case 'click': {
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await this.waitForLocator(resolved.locator, step, actionTimeout);
        await resolved.locator.click({ timeout: actionTimeout });
        return {
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'type': {
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await this.waitForLocator(resolved.locator, step, actionTimeout);
        await resolved.locator.fill(action_value ?? '', { timeout: actionTimeout });
        return {
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'select': {
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await this.waitForLocator(resolved.locator, step, actionTimeout);
        await resolved.locator.selectOption(action_value ?? '', { timeout: actionTimeout });
        return {
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'hover': {
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await this.waitForLocator(resolved.locator, step, actionTimeout);
        await resolved.locator.hover({ timeout: actionTimeout });
        return {
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'keypress': {
        await this.page.keyboard.press(action_value ?? 'Enter');
        return {};
      }

      case 'wait': {
        let resolved:
          | Awaited<ReturnType<SelectorResolver['resolve']>>
          | undefined;

        if (
          (step.wait_strategy === 'selector_visible' || step.wait_strategy === 'selector_hidden') &&
          step.target_selector?.trim()
        ) {
          resolved = await this.resolver.resolve(step, actionTimeout);
        }

        await this.applyWaitStrategy(step, resolved?.locator, actionTimeout);
        return {
          selectorUsed: resolved?.selectorUsed,
          selectorStrategyUsed: resolved?.strategyUsed,
          usedFallback: resolved?.usedFallback,
        };
      }

      case 'assert_text': {
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await this.waitForLocator(resolved.locator, step, actionTimeout);
        const text = await resolved.locator.innerText({ timeout: actionTimeout });
        if (action_value && !text.includes(action_value)) {
          throw new Error(
            `Text assertion failed: expected "${action_value}" not found. Got: "${text.slice(0, 200)}"`
          );
        }
        return {
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'assert_url': {
        const currentUrl = this.page.url();
        if (action_value && !currentUrl.includes(action_value)) {
          throw new Error(
            `URL assertion failed: expected "${action_value}" in "${currentUrl}"`
          );
        }
        return {};
      }

      case 'extract_text': {
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await this.waitForLocator(resolved.locator, step, actionTimeout);
        const extractedText = await resolved.locator.innerText({ timeout: actionTimeout });
        return {
          extractedText,
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'screenshot': {
        return {};
      }

      case 'upload_file': {
        if (!action_value?.trim()) {
          throw new Error('upload_file requires action_value to be a file path');
        }
        const filePath = resolveAllowedUploadPath(action_value);
        const resolved = await this.resolver.resolve(step, actionTimeout);
        await resolved.locator.setInputFiles(filePath, { timeout: actionTimeout });
        return {
          selectorUsed: resolved.selectorUsed,
          selectorStrategyUsed: resolved.strategyUsed,
          usedFallback: resolved.usedFallback,
        };
      }

      case 'conditional_branch': {
        return {};
      }

      default: {
        throw new Error(`Unsupported action type: ${action_type}`);
      }
    }
  }

  private async waitForLocator(
    locator: Locator,
    step: WorkflowStepData,
    timeout: number,
  ): Promise<void> {
    const { wait_strategy } = step;
    if (wait_strategy === 'selector_visible') {
      await locator.waitFor({ state: 'visible', timeout });
    } else if (wait_strategy === 'selector_hidden') {
      await locator.waitFor({ state: 'hidden', timeout });
    }
  }

  private async applyWaitStrategy(
    step: WorkflowStepData,
    locator: Locator | undefined,
    timeout: number,
  ): Promise<void> {
    const { wait_strategy, action_value } = step;
    switch (wait_strategy) {
      case 'network_idle':
        await this.page.waitForLoadState('networkidle', { timeout });
        break;
      case 'selector_visible':
        if (!locator) {
          throw new Error('selector_visible wait requires a target selector');
        }
        await locator.waitFor({ state: 'visible', timeout });
        break;
      case 'selector_hidden':
        if (!locator) {
          throw new Error('selector_hidden wait requires a target selector');
        }
        await locator.waitFor({ state: 'hidden', timeout });
        break;
      case 'fixed_delay': {
        const ms = parseInt(action_value ?? '1000', 10);
        await new Promise((r) => setTimeout(r, Number.isFinite(ms) ? ms : 1000));
        break;
      }
      case 'url_change': {
        const expectedUrl = action_value?.trim();
        if (expectedUrl) {
          assertNavigationTargetIfAbsolute(expectedUrl, this.allowedNavOrigins);
          await this.page.waitForURL(expectedUrl, { timeout });
          break;
        }

        const initialUrl = this.page.url();
        await this.page.waitForURL((url: URL) => url.toString() !== initialUrl, { timeout });
        break;
      }
      case 'none':
      default:
        break;
    }
  }
}

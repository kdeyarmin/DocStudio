import type { Page, Locator } from 'playwright';
import type { WorkflowStepData, SelectorStrategy } from '../types';

export interface ResolvedLocator {
  locator: Locator;
  selectorUsed: string;
  strategyUsed: SelectorStrategy;
  usedFallback: boolean;
  candidatesTried: number;
}

interface SelectorCandidate {
  selector: string;
  strategy: SelectorStrategy;
  locator: Locator;
}

const PROBE_TIMEOUT_MS = 1500;

export class SelectorResolver {
  constructor(private page: Page) {}

  async resolve(step: WorkflowStepData, actionTimeout: number): Promise<ResolvedLocator> {
    const candidates = this.buildCandidates(step);

    if (candidates.length === 0) {
      throw new Error(`No selector candidates for step ${step.step_order}: "${step.title}"`);
    }

    const primary = candidates[0];

    if (candidates.length === 1) {
      return {
        locator: primary.locator,
        selectorUsed: primary.selector,
        strategyUsed: primary.strategy,
        usedFallback: false,
        candidatesTried: 1,
      };
    }

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const probeTimeout = i === candidates.length - 1 ? actionTimeout : PROBE_TIMEOUT_MS;

      try {
        await candidate.locator.waitFor({ state: 'attached', timeout: probeTimeout });

        return {
          locator: candidate.locator,
          selectorUsed: candidate.selector,
          strategyUsed: candidate.strategy,
          usedFallback: i > 0,
          candidatesTried: i + 1,
        };
      } catch {
        if (i < candidates.length - 1) {
          console.warn(
            `[SelectorResolver] step ${step.step_order}: candidate ${i + 1}/${candidates.length} ` +
            `(${candidate.strategy}:"${candidate.selector}") not found, trying next`
          );
        }
      }
    }

    throw new Error(
      `[SelectorResolver] step ${step.step_order}: all ${candidates.length} selector ` +
      `candidates exhausted for "${step.title}"`
    );
  }

  private buildCandidates(step: WorkflowStepData): SelectorCandidate[] {
    const { target_selector, selector_strategy, action_type } = step;
    const candidates: SelectorCandidate[] = [];

    const primary = this.makeLocator(target_selector, selector_strategy);
    candidates.push({ selector: target_selector, strategy: selector_strategy, locator: primary });

    if (selector_strategy === 'css' && target_selector) {
      const textFallback = this.deriveTextFallback(target_selector);
      if (textFallback) {
        candidates.push({
          selector: textFallback,
          strategy: 'text',
          locator: this.page.getByText(textFallback, { exact: false }),
        });
      }

      const testidFallback = this.deriveTestId(target_selector);
      if (testidFallback) {
        candidates.push({
          selector: testidFallback,
          strategy: 'testid',
          locator: this.page.getByTestId(testidFallback),
        });
      }
    }

    if (selector_strategy !== 'css' && selector_strategy !== 'xpath') {
      const cssFallback = this.deriveCssFallback(target_selector, selector_strategy);
      if (cssFallback) {
        candidates.push({
          selector: cssFallback,
          strategy: 'css',
          locator: this.page.locator(cssFallback),
        });
      }
    }

    if ((action_type === 'click' || action_type === 'type') && selector_strategy !== 'role') {
      const roleFallback = this.deriveRoleFallback(target_selector, action_type);
      if (roleFallback) {
        const [role, name] = roleFallback.split('|');
        candidates.push({
          selector: roleFallback,
          strategy: 'role',
          locator: this.page.getByRole(
            role as Parameters<Page['getByRole']>[0],
            name ? { name } : undefined
          ),
        });
      }
    }

    return candidates;
  }

  private makeLocator(selector: string, strategy: SelectorStrategy): Locator {
    switch (strategy) {
      case 'text':
        return this.page.getByText(selector);
      case 'testid':
        return this.page.getByTestId(selector);
      case 'xpath':
        return this.page.locator(`xpath=${selector}`);
      case 'role': {
        const [role, ...rest] = selector.split('|');
        const name = rest.join('|') || undefined;
        return this.page.getByRole(
          role as Parameters<Page['getByRole']>[0],
          name ? { name } : undefined
        );
      }
      case 'css':
      default:
        return this.page.locator(selector);
    }
  }

  private deriveTextFallback(cssSelector: string): string | null {
    const ariaMatch = cssSelector.match(/\[aria-label="([^"]+)"\]/);
    if (ariaMatch) return ariaMatch[1];

    const placeholderMatch = cssSelector.match(/\[placeholder="([^"]+)"\]/);
    if (placeholderMatch) return placeholderMatch[1];

    const valueMatch = cssSelector.match(/\[value="([^"]+)"\]/);
    if (valueMatch) return valueMatch[1];

    return null;
  }

  private deriveTestId(cssSelector: string): string | null {
    const dataTestId = cssSelector.match(/\[data-testid="([^"]+)"\]/);
    if (dataTestId) return dataTestId[1];

    const dataTest = cssSelector.match(/\[data-test="([^"]+)"\]/);
    if (dataTest) return dataTest[1];

    const dataCy = cssSelector.match(/\[data-cy="([^"]+)"\]/);
    if (dataCy) return dataCy[1];

    return null;
  }

  private deriveCssFallback(selector: string, strategy: SelectorStrategy): string | null {
    if (strategy === 'text') {
      return `[aria-label="${selector}"]`;
    }
    if (strategy === 'testid') {
      return `[data-testid="${selector}"]`;
    }
    return null;
  }

  private deriveRoleFallback(selector: string, actionType: string): string | null {
    if (actionType === 'click') {
      const ariaMatch = selector.match(/\[aria-label="([^"]+)"\]/);
      if (ariaMatch) return `button|${ariaMatch[1]}`;
    }
    if (actionType === 'type') {
      if (selector.includes('[type="email"]')) return `textbox|Email`;
      if (selector.includes('[type="password"]')) return `textbox|Password`;
    }
    return null;
  }
}

import type { AutomationProvider } from './AutomationProvider';
import { MockAutomationProvider } from './MockAutomationProvider';
import { FuturePlaywrightProvider } from './FuturePlaywrightProvider';
import type { PlaywrightSettings, WorkflowAutomationMode } from '../../types/documentation';

let _mockInstance: MockAutomationProvider | null = null;
let _playwrightInstance: FuturePlaywrightProvider | null = null;

export function getAutomationProvider(
  settings: PlaywrightSettings | null,
  forceMode?: WorkflowAutomationMode
): AutomationProvider {
  const mode = forceMode ?? settings?.provider_active ?? 'mock';

  if (mode === 'playwright' && settings?.playwright_enabled) {
    if (!_playwrightInstance) _playwrightInstance = new FuturePlaywrightProvider();
    return _playwrightInstance;
  }

  if (!_mockInstance) _mockInstance = new MockAutomationProvider();
  return _mockInstance;
}

export function resetProviderInstances(): void {
  _mockInstance = null;
  _playwrightInstance = null;
}

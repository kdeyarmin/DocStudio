import type {
  DocumentationJob,
  TriggerJobPayload,
} from '../../types/documentation';

export interface RunContext {
  jobId: string;
  workflowId: string;
  providerMode: string;
  demoAccountId?: string;
  draftId?: string;
  onStatusChange?: (status: string) => void;
  onEvent?: (eventType: string, payload: Record<string, unknown>) => void;
}

export interface AutomationProvider {
  readonly name: string;

  createRun(payload: TriggerJobPayload): Promise<{ jobId: string }>;
  cancelRun(jobId: string): Promise<void>;
  pollJob(jobId: string): Promise<DocumentationJob>;
}

export interface ProviderCapabilities {
  supportsVideo: boolean;
  supportsTrace: boolean;
  supportsRealScreenshots: boolean;
  supportsRetry: boolean;
  isAsync: boolean;
}

export interface AutomationProviderWithCapabilities extends AutomationProvider {
  getCapabilities(): ProviderCapabilities;
}

export function isMockProvider(p: AutomationProvider): boolean {
  return p.name === 'mock';
}

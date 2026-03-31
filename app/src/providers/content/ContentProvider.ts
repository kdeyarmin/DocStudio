import type { GeneratedContent } from '../../types/doc-studio';
import type { StepExecutionResult, DocumentationWorkflowStep } from '../../types/documentation';

export interface ContentGenerationPayload {
  jobId: string;
  draftId: string;
  organizationId: string;
}

export interface TraceContentGenerationPayload extends ContentGenerationPayload {
  executionTrace: {
    workflowName: string;
    workflowDescription: string | null;
    steps: DocumentationWorkflowStep[];
    stepResults: StepExecutionResult[];
    durationSeconds: number;
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
  };
  outputType: string;
  targetRole: string | null;
}

export interface ContentGenerationResult {
  generatedContent: GeneratedContent;
  provider: string;
  model: string;
}

export interface TraceContentGenerationResult extends ContentGenerationResult {
  guide_sections: Array<{ heading: string; body: string }>;
  troubleshooting: Array<{ problem: string; solution: string }>;
  quality_notes: string | null;
}

export interface ContentProvider {
  readonly name: string;
  generateContent(payload: ContentGenerationPayload): Promise<ContentGenerationResult>;
  generateContentFromTrace?(payload: TraceContentGenerationPayload): Promise<TraceContentGenerationResult>;
}

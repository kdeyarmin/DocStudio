import { supabase } from '../../lib/supabase';
import type {
  ContentProvider,
  ContentGenerationPayload,
  ContentGenerationResult,
  TraceContentGenerationPayload,
  TraceContentGenerationResult,
} from './ContentProvider';

const GENERATE_FN = 'doc-studio-generate-content';

export class FutureOpenAIContentProvider implements ContentProvider {
  readonly name = 'openai';

  async generateContent(payload: ContentGenerationPayload): Promise<ContentGenerationResult> {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      generated_content: ContentGenerationResult['generatedContent'];
      provider: string;
      model: string;
      error?: string;
    }>(GENERATE_FN, { body: { action: 'generate', ...payload } });

    if (error) throw new Error(error.message ?? 'Content generation request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Content generation failed');

    return {
      generatedContent: data.generated_content,
      provider: data.provider ?? 'openai',
      model: data.model ?? 'unknown',
    };
  }

  async generateContentFromTrace(payload: TraceContentGenerationPayload): Promise<TraceContentGenerationResult> {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      generated_content: ContentGenerationResult['generatedContent'];
      guide_sections: Array<{ heading: string; body: string }>;
      troubleshooting: Array<{ problem: string; solution: string }>;
      quality_notes: string | null;
      provider: string;
      model: string;
      error?: string;
    }>(GENERATE_FN, {
      body: {
        action: 'generate_from_trace',
        job_id: payload.jobId,
        draft_id: payload.draftId,
        organization_id: payload.organizationId,
        output_type: payload.outputType,
        target_role: payload.targetRole,
        execution_trace: {
          workflow_name: payload.executionTrace.workflowName,
          workflow_description: payload.executionTrace.workflowDescription,
          steps: payload.executionTrace.steps,
          step_results: payload.executionTrace.stepResults,
          duration_seconds: payload.executionTrace.durationSeconds,
          total_steps: payload.executionTrace.totalSteps,
          successful_steps: payload.executionTrace.successfulSteps,
          failed_steps: payload.executionTrace.failedSteps,
        },
      },
    });

    if (error) throw new Error(error.message ?? 'Trace content generation request failed');
    if (!data?.success) throw new Error(data?.error ?? 'Trace content generation failed');

    return {
      generatedContent: data.generated_content,
      guide_sections: data.guide_sections ?? [],
      troubleshooting: data.troubleshooting ?? [],
      quality_notes: data.quality_notes ?? null,
      provider: data.provider ?? 'openai',
      model: data.model ?? 'unknown',
    };
  }
}

import { supabase } from '../../lib/supabase';
import type { AutomationProvider, ProviderCapabilities } from './AutomationProvider';
import type {
  DocumentationJob,
  JobStatus,
  TriggerJobPayload,
} from '../../types/documentation';
import { JOB_EVENT_TYPES } from '../../types/documentation';

const MOCK_STEP_DELAY_MS = 800;
const MOCK_AUTH_DELAY_MS = 600;

async function _resolveCallerOrganizationId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', session.user.id)
    .maybeSingle();
  return profile?.organization_id ?? null;
}

async function writeEvent(
  jobId: string,
  eventType: string,
  title: string,
  description: string,
  severity: string = 'info',
  payload: Record<string, unknown> = {}
) {
  await supabase.from('documentation_job_events').insert({
    job_id: jobId,
    event_type: eventType,
    title,
    description,
    severity,
    payload_json: payload,
  });
}

async function updateJobStatus(jobId: string, status: JobStatus, extra: Record<string, unknown> = {}) {
  await supabase
    .from('documentation_jobs')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockAutomationProvider implements AutomationProvider {
  readonly name = 'mock';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVideo: false,
      supportsTrace: false,
      supportsRealScreenshots: false,
      supportsRetry: true,
      isAsync: false,
    };
  }

  async createRun(payload: TriggerJobPayload): Promise<{ jobId: string }> {
    if (!payload.organization_id) {
      throw new Error('organization_id is required to create a documentation job');
    }
    const { data: job, error } = await supabase
      .from('documentation_jobs')
      .insert({
        workflow_id: payload.workflow_id,
        draft_id: payload.draft_id ?? null,
        organization_id: payload.organization_id ?? null,
        provider_mode: 'mock',
        status: 'queued',
        selected_demo_account_id: payload.demo_account_id ?? null,
        version_label: payload.version_label ?? null,
        custom_title: payload.custom_title ?? null,
        notes: payload.notes ?? null,
        output_type: payload.output_type ?? 'full_package',
        environment: payload.environment ?? 'demo',
        metadata_json: {},
        execution_summary_json: {},
        step_results_json: [],
        logs_json: {},
      })
      .select('id')
      .single();

    if (error || !job) throw new Error(error?.message ?? 'Failed to create job');

    this._runMockWorkflow(job.id, payload).catch(console.error);

    return { jobId: job.id };
  }

  async cancelRun(jobId: string): Promise<void> {
    await updateJobStatus(jobId, 'cancelled');
    await writeEvent(jobId, JOB_EVENT_TYPES.JOB_CANCELLED, 'Job Cancelled', 'Run was cancelled by user.', 'warning');
  }

  async pollJob(jobId: string): Promise<DocumentationJob> {
    const { data, error } = await supabase
      .from('documentation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Job not found');
    return data as DocumentationJob;
  }

  private async _runMockWorkflow(jobId: string, payload: TriggerJobPayload) {
    const startedAt = new Date().toISOString();
    await updateJobStatus(jobId, 'preparing', { started_at: startedAt });
    await writeEvent(jobId, JOB_EVENT_TYPES.PROVIDER_RESOLVED, 'Provider Resolved', 'Mock automation provider selected.', 'info', { provider: 'mock' });
    await delay(500);

    await updateJobStatus(jobId, 'running');
    await writeEvent(jobId, JOB_EVENT_TYPES.SESSION_STARTED, 'Session Started', 'Mock browser session initialised.', 'info');
    await delay(MOCK_AUTH_DELAY_MS);

    await writeEvent(jobId, JOB_EVENT_TYPES.AUTH_STARTED, 'Auth Started', 'Performing mock login.', 'info');
    await delay(MOCK_AUTH_DELAY_MS);
    await writeEvent(jobId, JOB_EVENT_TYPES.AUTH_SUCCEEDED, 'Auth Succeeded', 'Mock login completed successfully.', 'success');

    const { data: steps } = await supabase
      .from('documentation_workflow_steps')
      .select('*')
      .eq('workflow_id', payload.workflow_id)
      .order('step_order', { ascending: true });

    const stepResults = [];

    if (steps && steps.length > 0) {
      await updateJobStatus(jobId, 'capturing');
      for (const step of steps) {
        const stepStart = Date.now();
        await writeEvent(
          jobId,
          JOB_EVENT_TYPES.STEP_STARTED,
          `Step ${step.step_order}: ${step.title}`,
          `Executing: ${step.action_type} — ${step.target_selector || step.title}`,
          'info',
          { step_id: step.id, step_order: step.step_order, action_type: step.action_type }
        );

        await delay(MOCK_STEP_DELAY_MS);

        const durationMs = Date.now() - stepStart;

        stepResults.push({
          step_id: step.id,
          step_order: step.step_order,
          title: step.title,
          action_type: step.action_type,
          status: 'success',
          duration_ms: durationMs,
          retry_attempts: 0,
          used_fallback: false,
          selector_used: step.target_selector,
          started_at: new Date(Date.now() - durationMs).toISOString(),
          completed_at: new Date().toISOString(),
        });

        await writeEvent(
          jobId,
          JOB_EVENT_TYPES.STEP_COMPLETED,
          `Step ${step.step_order} completed`,
          step.title,
          'success',
          { step_id: step.id, duration_ms: durationMs }
        );

        if (step.screenshot_checkpoint) {
          await writeEvent(
            jobId,
            JOB_EVENT_TYPES.SCREENSHOT_CAPTURED,
            'Screenshot Captured',
            step.screenshot_caption_template || step.title,
            'info',
            { step_id: step.id, mock: true }
          );
        }
      }
    }

    await updateJobStatus(jobId, 'generating_content');
    await writeEvent(jobId, JOB_EVENT_TYPES.CONTENT_GENERATION_STARTED, 'Generating Content', 'Mock content generation started.', 'info');
    await delay(1200);

    const completedAt = new Date().toISOString();
    const durationSeconds = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);

    await updateJobStatus(jobId, 'ready_for_review', {
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      asset_count: 0,
      step_results_json: stepResults,
      execution_summary_json: {
        provider: 'mock',
        total_steps: steps?.length ?? 0,
        completed_steps: steps?.length ?? 0,
        failed_steps: 0,
        duration_seconds: durationSeconds,
        completed_at: completedAt,
      },
    });

    await writeEvent(jobId, JOB_EVENT_TYPES.CONTENT_GENERATION_COMPLETED, 'Content Generation Complete', 'Mock content ready for review.', 'success');
    await writeEvent(jobId, JOB_EVENT_TYPES.WORKFLOW_COMPLETED, 'Workflow Completed', `Mock run finished in ${durationSeconds}s.`, 'success', { duration_seconds: durationSeconds });

    if (payload.draft_id) {
      await supabase
        .from('doc_studio_drafts')
        .update({
          status: 'ready_for_review',
          updated_at: completedAt,
        })
        .eq('id', payload.draft_id);
    }
  }
}

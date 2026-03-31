import { supabase } from '../../lib/supabase';
import type { AutomationProvider, ProviderCapabilities } from './AutomationProvider';
import type { DocumentationJob, TriggerJobPayload } from '../../types/documentation';

const POLL_EDGE_FUNCTION = 'doc-studio-jobs';
const DISPATCH_EDGE_FUNCTION = 'doc-studio-playwright';

export class FuturePlaywrightProvider implements AutomationProvider {
  readonly name = 'playwright';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVideo: true,
      supportsTrace: true,
      supportsRealScreenshots: true,
      supportsRetry: true,
      isAsync: true,
    };
  }

  async createRun(payload: TriggerJobPayload): Promise<{ jobId: string }> {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase.functions.invoke(DISPATCH_EDGE_FUNCTION, {
      body: {
        action: 'dispatch',
        payload: {
          ...payload,
          organization_id: sessionData.session?.user.user_metadata?.organization_id
            ?? userData.user?.user_metadata?.organization_id
            ?? null,
          created_by: userData.user?.id ?? null,
        },
      },
    });

    if (error) throw new Error(error.message ?? 'Failed to dispatch Playwright job');
    if (!data?.job_id) throw new Error('No job_id returned from dispatch');

    return { jobId: data.job_id };
  }

  async cancelRun(jobId: string): Promise<void> {
    const { error } = await supabase.functions.invoke(DISPATCH_EDGE_FUNCTION, {
      body: { action: 'cancel', job_id: jobId },
    });

    if (error) throw new Error(error.message ?? 'Failed to cancel Playwright job');
  }

  async pollJob(jobId: string): Promise<DocumentationJob> {
    const { data, error } = await supabase.functions.invoke(POLL_EDGE_FUNCTION, {
      body: { action: 'get', job_id: jobId },
    });

    if (error) throw new Error(error.message ?? 'Failed to poll job');
    if (!data?.job) throw new Error('Job not found');

    return data.job as DocumentationJob;
  }
}

import type { ErrorHandlingStrategy } from '../types';

export function shouldStopWorkflowOnFailure(strategy: ErrorHandlingStrategy | undefined): boolean {
  return strategy === 'fail' || strategy === 'retry' || strategy === 'fallback_to_manual_step';
}

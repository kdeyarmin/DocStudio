import { describe, it, expect } from 'vitest';
import { shouldStopWorkflowOnFailure } from './workflow-helpers';

describe('shouldStopWorkflowOnFailure', () => {
  it('returns true for "fail" strategy', () => {
    expect(shouldStopWorkflowOnFailure('fail')).toBe(true);
  });

  it('returns true for "retry" strategy', () => {
    expect(shouldStopWorkflowOnFailure('retry')).toBe(true);
  });

  it('returns true for "fallback_to_manual_step" strategy', () => {
    expect(shouldStopWorkflowOnFailure('fallback_to_manual_step')).toBe(true);
  });

  it('returns false for "skip" strategy', () => {
    expect(shouldStopWorkflowOnFailure('skip')).toBe(false);
  });

  it('returns false for undefined strategy', () => {
    expect(shouldStopWorkflowOnFailure(undefined)).toBe(false);
  });
});

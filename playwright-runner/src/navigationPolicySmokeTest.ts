import type { RunRequest } from './types';
import { buildNavigationPolicy } from './runner/WorkflowRunner';

function createRequest(overrides?: Partial<RunRequest>): RunRequest {
  return {
    job_id: 'job-123',
    workflow: {
      id: 'wf-1',
      name: 'Smoke Test',
      start_url: '/dashboard',
      success_url_pattern: '/dashboard',
      requires_auth: false,
      uses_demo_account: false,
      steps: [],
    },
    demo_account: null,
    settings: {
      playwright_base_url: 'https://demo.caremetric.test',
      playwright_login_path: '/login',
      playwright_username_selector: 'input[type="email"]',
      playwright_password_selector: 'input[type="password"]',
      playwright_submit_selector: 'button[type="submit"]',
      playwright_success_url_pattern: '/dashboard',
      viewport_width: 1280,
      viewport_height: 800,
      headless: true,
      trace_enabled: false,
      screenshots_enabled: true,
      video_enabled: false,
      retain_partial_assets_on_failure: false,
      step_timeout_ms: 30000,
      action_timeout_ms: 10000,
      navigation_timeout_ms: 30000,
    },
    callback_url: 'https://project.supabase.co/functions/v1/runner-callback',
    callback_token: 'callback-token',
    supabase_service_role_key: 'service-role-key',
    ...overrides,
  };
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function assertThrows(fn: () => unknown, expectedMessage: string, label: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedMessage)) {
      return;
    }
    throw new Error(`${label}: expected error containing "${expectedMessage}", got "${message}"`);
  }

  throw new Error(`${label}: expected function to throw`);
}

function main(): void {
  const policy = buildNavigationPolicy(createRequest());

  assertEqual(
    policy.resolveUrl('/patients/123'),
    'https://demo.caremetric.test/patients/123',
    'relative paths resolve against the trusted base URL',
  );

  assertEqual(
    policy.resolveUrl('https://demo.caremetric.test/settings'),
    'https://demo.caremetric.test/settings',
    'same-origin absolute URLs are allowed',
  );

  assertThrows(
    () => policy.resolveUrl('https://attacker.example/steal'),
    'is not allowed',
    'cross-origin navigation is blocked',
  );

  assertThrows(
    () => policy.resolveUrl('javascript:alert(1)'),
    'is not allowed',
    'dangerous schemes are blocked',
  );

  console.log('navigation policy smoke test passed');
}

main();

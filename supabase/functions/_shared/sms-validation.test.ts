/**
 * Unit tests for SMS request validation helpers.
 *
 * Run with:
 *   deno test --allow-none supabase/functions/_shared/sms-validation.test.ts
 */
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getRequiredString,
  getOptionalString,
  parseSendSMSRequest,
} from './sms-validation.ts';

// ── getRequiredString ────────────────────────────────────────────────────────

Deno.test('getRequiredString: returns first non-empty string', () => {
  assertEquals(getRequiredString('hello'), 'hello');
});

Deno.test('getRequiredString: skips null/undefined, returns first string', () => {
  assertEquals(getRequiredString(null, undefined, 'found'), 'found');
});

Deno.test('getRequiredString: trims whitespace', () => {
  assertEquals(getRequiredString('  padded  '), 'padded');
});

Deno.test('getRequiredString: returns null for whitespace-only string', () => {
  assertEquals(getRequiredString('   '), null);
});

Deno.test('getRequiredString: returns null for empty string', () => {
  assertEquals(getRequiredString(''), null);
});

Deno.test('getRequiredString: returns null when all values are non-strings', () => {
  assertEquals(getRequiredString(null, undefined, 42, true), null);
});

Deno.test('getRequiredString: returns null for no arguments', () => {
  assertEquals(getRequiredString(), null);
});

Deno.test('getRequiredString: skips empty first, returns second', () => {
  assertEquals(getRequiredString('', 'fallback'), 'fallback');
});

// ── getOptionalString ────────────────────────────────────────────────────────

Deno.test('getOptionalString: returns first string value trimmed', () => {
  assertEquals(getOptionalString(' test '), 'test');
});

Deno.test('getOptionalString: returns undefined for empty string', () => {
  assertEquals(getOptionalString(''), undefined);
});

Deno.test('getOptionalString: returns undefined when no values provided', () => {
  assertEquals(getOptionalString(), undefined);
});

Deno.test('getOptionalString: skips non-string values', () => {
  assertEquals(getOptionalString(null, undefined, 42, 'found'), 'found');
});

Deno.test('getOptionalString: returns undefined for whitespace-only string', () => {
  assertEquals(getOptionalString('   '), undefined);
});

// ── parseSendSMSRequest ──────────────────────────────────────────────────────

Deno.test('parseSendSMSRequest: valid camelCase request', () => {
  const result = parseSendSMSRequest({
    to: '+15551234567',
    message: 'Hello',
    organizationId: 'org-123',
    patientId: 'pat-456',
  });
  assertEquals(result.error, undefined);
  assertEquals(result.data?.to, '+15551234567');
  assertEquals(result.data?.message, 'Hello');
  assertEquals(result.data?.organizationId, 'org-123');
  assertEquals(result.data?.patientId, 'pat-456');
});

Deno.test('parseSendSMSRequest: valid snake_case request (field aliasing)', () => {
  const result = parseSendSMSRequest({
    to: '+15551234567',
    body: 'Hello from body',
    organization_id: 'org-789',
    patient_id: 'pat-012',
  });
  assertEquals(result.error, undefined);
  assertEquals(result.data?.message, 'Hello from body');
  assertEquals(result.data?.organizationId, 'org-789');
  assertEquals(result.data?.patientId, 'pat-012');
});

Deno.test('parseSendSMSRequest: camelCase takes precedence over snake_case', () => {
  const result = parseSendSMSRequest({
    to: '+15551234567',
    message: 'camelMessage',
    body: 'snakeBody',
    organizationId: 'camelOrg',
    organization_id: 'snakeOrg',
  });
  assertEquals(result.data?.message, 'camelMessage');
  assertEquals(result.data?.organizationId, 'camelOrg');
});

Deno.test('parseSendSMSRequest: patientId is optional', () => {
  const result = parseSendSMSRequest({
    to: '+15551234567',
    message: 'Hello',
    organizationId: 'org-123',
  });
  assertEquals(result.error, undefined);
  assertEquals(result.data?.patientId, undefined);
});

Deno.test('parseSendSMSRequest: missing "to" returns error', () => {
  const result = parseSendSMSRequest({
    message: 'Hello',
    organizationId: 'org-123',
  });
  assertEquals(result.data, undefined);
  assertEquals(result.error, 'Missing required fields: to, message, organizationId');
});

Deno.test('parseSendSMSRequest: missing "message" and "body" returns error', () => {
  const result = parseSendSMSRequest({
    to: '+15551234567',
    organizationId: 'org-123',
  });
  assertEquals(result.data, undefined);
  assertEquals(result.error, 'Missing required fields: to, message, organizationId');
});

Deno.test('parseSendSMSRequest: missing "organizationId" and "organization_id" returns error', () => {
  const result = parseSendSMSRequest({
    to: '+15551234567',
    message: 'Hello',
  });
  assertEquals(result.data, undefined);
  assertEquals(result.error, 'Missing required fields: to, message, organizationId');
});

Deno.test('parseSendSMSRequest: null body returns error', () => {
  const result = parseSendSMSRequest(null);
  assertEquals(result.error, 'Invalid JSON in request body');
});

Deno.test('parseSendSMSRequest: array body returns error', () => {
  const result = parseSendSMSRequest([{ to: '123' }]);
  assertEquals(result.error, 'Invalid JSON in request body');
});

Deno.test('parseSendSMSRequest: non-object body returns error', () => {
  const result = parseSendSMSRequest('not an object');
  assertEquals(result.error, 'Invalid JSON in request body');
});

Deno.test('parseSendSMSRequest: whitespace-only fields treated as missing', () => {
  const result = parseSendSMSRequest({
    to: '   ',
    message: 'Hello',
    organizationId: 'org-123',
  });
  assertEquals(result.data, undefined);
  assertEquals(result.error, 'Missing required fields: to, message, organizationId');
});

Deno.test('parseSendSMSRequest: trims whitespace from valid fields', () => {
  const result = parseSendSMSRequest({
    to: '  +15551234567  ',
    message: '  Hello  ',
    organizationId: '  org-123  ',
  });
  assertEquals(result.data?.to, '+15551234567');
  assertEquals(result.data?.message, 'Hello');
  assertEquals(result.data?.organizationId, 'org-123');
});

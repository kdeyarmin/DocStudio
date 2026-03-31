/**
 * Unit tests for phone number normalization.
 *
 * Run with:
 *   deno test --allow-none supabase/functions/_shared/phone.test.ts
 */
import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { normalizeUsPhoneNumber } from './phone.ts';

Deno.test('normalizeUsPhoneNumber: 10-digit number gets +1 prefix', () => {
  assertEquals(normalizeUsPhoneNumber('5551234567'), '+15551234567');
});

Deno.test('normalizeUsPhoneNumber: 11-digit number starting with 1 gets + prefix', () => {
  assertEquals(normalizeUsPhoneNumber('15551234567'), '+15551234567');
});

Deno.test('normalizeUsPhoneNumber: strips non-digit characters', () => {
  assertEquals(normalizeUsPhoneNumber('(555) 123-4567'), '+15551234567');
  assertEquals(normalizeUsPhoneNumber('555.123.4567'), '+15551234567');
  assertEquals(normalizeUsPhoneNumber('+1-555-123-4567'), '+15551234567');
});

Deno.test('normalizeUsPhoneNumber: throws for 9-digit number', () => {
  assertThrows(
    () => normalizeUsPhoneNumber('555123456'),
    Error,
    'Invalid phone number',
  );
});

Deno.test('normalizeUsPhoneNumber: throws for 12-digit number', () => {
  assertThrows(
    () => normalizeUsPhoneNumber('155512345678'),
    Error,
    'Invalid phone number',
  );
});

Deno.test('normalizeUsPhoneNumber: throws for empty string', () => {
  assertThrows(
    () => normalizeUsPhoneNumber(''),
    Error,
    'Invalid phone number',
  );
});

Deno.test('normalizeUsPhoneNumber: throws for letters only', () => {
  assertThrows(
    () => normalizeUsPhoneNumber('abcdefghij'),
    Error,
    'Invalid phone number',
  );
});

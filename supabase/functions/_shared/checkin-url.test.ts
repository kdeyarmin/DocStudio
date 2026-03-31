/**
 * Unit tests for checkin URL resolution.
 *
 * Run with:
 *   deno test supabase/functions/_shared/checkin-url.test.ts
 */
import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveCheckinUrl } from './checkin-url.ts';

Deno.test('resolveCheckinUrl: uses provided base URL', () => {
  const url = resolveCheckinUrl('https://app.example.com', 'tok123');
  assertEquals(url, 'https://app.example.com/ccm/checkin?token=tok123');
});

Deno.test('resolveCheckinUrl: strips trailing slashes from base URL', () => {
  const url = resolveCheckinUrl('https://app.example.com/', 'tok');
  assertEquals(url, 'https://app.example.com/ccm/checkin?token=tok');
});

Deno.test('resolveCheckinUrl: URL-encodes token with special characters', () => {
  const url = resolveCheckinUrl('https://app.example.com', 'a b&c=d');
  assertEquals(url, 'https://app.example.com/ccm/checkin?token=a%20b%26c%3Dd');
});

Deno.test('resolveCheckinUrl: falls back to envAppUrl when base is null', () => {
  const url = resolveCheckinUrl(null, 'tok', 'https://env-app.example.com');
  assertEquals(url, 'https://env-app.example.com/ccm/checkin?token=tok');
});

Deno.test('resolveCheckinUrl: falls back to envSiteUrl when appUrl is undefined', () => {
  const url = resolveCheckinUrl(undefined, 'tok', undefined, 'https://site.example.com');
  assertEquals(url, 'https://site.example.com/ccm/checkin?token=tok');
});

Deno.test('resolveCheckinUrl: falls back to hardcoded default when all args missing', () => {
  const url = resolveCheckinUrl(null, 'tok');
  assertEquals(url, 'https://app.caremetric.ai/ccm/checkin?token=tok');
});

/**
 * Unit tests for webhook signature helpers.
 *
 * Run with:
 *   npm run test
 *   or: deno test --allow-net supabase/functions/_shared/webhook-verify.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { matchesAnySecret } from './webhook-verify.ts';

Deno.test('matchesAnySecret matches any configured secret', () => {
  assertEquals(matchesAnySecret('token-a', 'token-b', 'token-a'), true);
  assertEquals(matchesAnySecret('token-a', undefined, 'token-c'), false);
  assertEquals(matchesAnySecret(undefined, 'token-a'), false);
  assertEquals(matchesAnySecret('token-a', undefined, null), false);
});

/**
 * Minimal unit tests for pure helper behavior in ai-provider.ts.
 */
import {
  assert,
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  callAI,
  detectProvider,
  getDefaultModel,
  listModels,
  resolveAIConfig,
} from './ai-provider.ts';

Deno.test('detectProvider maps common prefixes', () => {
  assertEquals(detectProvider('gpt-4.1'), 'openai');
  assertEquals(detectProvider('o4-mini'), 'openai');
  assertEquals(detectProvider('gemini-2.5-pro'), 'google');
  assertEquals(detectProvider('claude-sonnet-4-6'), 'anthropic');
});

Deno.test('listModels returns non-empty unique model ids per provider', () => {
  for (const provider of ['openai', 'google', 'anthropic'] as const) {
    const models = listModels(provider);
    assert(models.length > 0);
    assertEquals(new Set(models).size, models.length);
  }
});

Deno.test('default model is always part of provider model list', () => {
  for (const provider of ['openai', 'google', 'anthropic'] as const) {
    const model = getDefaultModel(provider);
    assert(listModels(provider).includes(model));
  }
});

Deno.test('resolveAIConfig returns null when no org/global provider keys are configured', async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          };
        },
      };
    },
  };

  const config = await resolveAIConfig(supabase as never, 'org-1');
  assertEquals(config, null);
});

Deno.test('callAI throws for unknown provider name', async () => {
  await assertRejects(
    async () => {
      await callAI(
        {
          provider: 'unknown-provider' as never,
          apiKey: 'key',
          model: 'model',
        },
        {
          messages: [{ role: 'user', content: 'hello' }],
        },
      );
    },
    Error,
  );
});

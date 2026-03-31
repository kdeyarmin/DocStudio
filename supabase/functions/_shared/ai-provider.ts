/** Minimal interface for the Supabase client methods used in AI provider resolution. */
interface SupabaseClientLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
  };
}

export type AIProvider = 'anthropic' | 'openai' | 'google';

export interface AIRequest {
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export type AITaskType =
  | 'tutorial_generation'
  | 'content_writing'
  | 'shot_classification'
  | 'review_insights'
  | 'narration';

const ANTHROPIC_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-opus-4-5',
  'claude-haiku-4-5',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
];

const OPENAI_MODELS = [
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'o4-mini',
  'o3',
  'o3-mini',
  'o1',
  'o1-mini',
];

// Reasoning models that require max_completion_tokens instead of max_tokens
// and do not support temperature, top_p, etc.
const OPENAI_REASONING_MODELS = new Set(['o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini']);

const GOOGLE_MODELS = [
  'gemini-3.1-pro',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
];

export function detectProvider(modelName: string): AIProvider {
  const normalized = (modelName || '').toLowerCase();
  if (normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4') || normalized.startsWith('o5')) {
    return 'openai';
  }
  if (normalized.startsWith('gemini')) {
    return 'google';
  }
  return 'anthropic';
}

export function getDefaultModel(provider: AIProvider): string {
  if (provider === 'openai') return 'gpt-5.4';
  if (provider === 'google') return 'gemini-3-flash';
  return 'claude-sonnet-4-6';
}

export function listModels(provider: AIProvider): string[] {
  if (provider === 'openai') return OPENAI_MODELS;
  if (provider === 'google') return GOOGLE_MODELS;
  return ANTHROPIC_MODELS;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function validateModel(provider: AIProvider, model: string): string {
  const validModels = listModels(provider);
  if (validModels.includes(model)) return model;
  return getDefaultModel(provider);
}

async function callAnthropic(
  config: AIProviderConfig,
  request: AIRequest,
  timeoutMs = 55000,
): Promise<AIResponse> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  const model = validateModel('anthropic', config.model);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages: request.messages,
      }),
      signal: abort.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error('AI API key is invalid or has been revoked. Please update the Anthropic API key in Platform Settings.');
    }
    if (response.status === 403) {
      throw new Error('AI API key does not have permission for this operation. Please check the Anthropic API key in Platform Settings.');
    }
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data: { content?: Array<{ text: string }> } = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('No content in Anthropic response');

  return { text, provider: 'anthropic', model };
}

async function callOpenAI(
  config: AIProviderConfig,
  request: AIRequest,
  timeoutMs = 55000,
): Promise<AIResponse> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  const model = validateModel('openai', config.model);
  const isReasoning = OPENAI_REASONING_MODELS.has(model);
  const messages: Array<{ role: string; content: string }> = [];
  if (request.systemPrompt) {
    // Reasoning models use 'developer' role instead of 'system'
    messages.push({ role: isReasoning ? 'developer' : 'system', content: request.systemPrompt });
  }
  messages.push(...request.messages);

  // Reasoning models (o1/o3/o4) don't support max_tokens or temperature
  const body: Record<string, unknown> = { model, messages };
  if (isReasoning) {
    body.max_completion_tokens = request.maxTokens ?? 16384;
  } else {
    body.max_tokens = request.maxTokens ?? 4096;
    body.temperature = request.temperature ?? 0.7;
  }

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error('AI API key is invalid or has been revoked. Please update the OpenAI API key in Platform Settings.');
    }
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data: { choices?: Array<{ message?: { content?: string } }> } = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No content in OpenAI response');

  return { text, provider: 'openai', model };
}

async function callGemini(
  config: AIProviderConfig,
  request: AIRequest,
  timeoutMs = 55000,
): Promise<AIResponse> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  const model = validateModel('google', config.model);

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (request.systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: request.systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  for (const msg of request.messages) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? 4096,
            temperature: request.temperature ?? 0.7,
          },
        }),
        signal: abort.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error('AI API key is invalid or has been revoked. Please update the Google AI API key in Platform Settings.');
    }
    throw new Error(`Google Gemini API error ${response.status}: ${errorText}`);
  }

  const data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content in Gemini response');

  return { text, provider: 'google', model };
}

export async function callAI(
  config: AIProviderConfig,
  request: AIRequest,
  timeoutMs = 55000,
): Promise<AIResponse> {
  if (config.provider === 'openai') {
    return callOpenAI(config, request, timeoutMs);
  }
  if (config.provider === 'google') {
    return callGemini(config, request, timeoutMs);
  }
  return callAnthropic(config, request, timeoutMs);
}

export async function resolveAIConfig(
  supabase: SupabaseClientLike,
  organizationId?: string,
): Promise<AIProviderConfig | null> {
  if (organizationId) {
    const { data: orgSettings } = await supabase
      .from('organization_integration_settings')
      .select('ai_api_provider, ai_api_key, ai_model_name')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const orgApiKey = asNonEmptyString(orgSettings?.ai_api_key);
    const orgProviderValue = asNonEmptyString(orgSettings?.ai_api_provider);
    const orgModelName = asNonEmptyString(orgSettings?.ai_model_name);

    if (orgApiKey && orgProviderValue) {
      const provider = orgProviderValue === 'openai'
        ? 'openai'
        : orgProviderValue === 'google'
        ? 'google'
        : 'anthropic';
      const rawModel = orgModelName || getDefaultModel(provider);
      const model = validateModel(provider, rawModel);
      return { provider, apiKey: orgApiKey, model };
    }
  }

  const { data: claudeKey } = await supabase
    .from('platform_global_api_keys')
    .select('api_key, ai_model_name')
    .eq('service_name', 'claude')
    .eq('is_active', true)
    .maybeSingle();

  const claudeApiKey = asNonEmptyString(claudeKey?.api_key);
  const claudeModelName = asNonEmptyString(claudeKey?.ai_model_name);

  if (claudeApiKey) {
    const rawModel = claudeModelName || 'claude-sonnet-4-6';
    const model = validateModel('anthropic', rawModel);
    return { provider: 'anthropic', apiKey: claudeApiKey, model };
  }

  const { data: openaiKey } = await supabase
    .from('platform_global_api_keys')
    .select('api_key, ai_model_name')
    .eq('service_name', 'openai')
    .eq('is_active', true)
    .maybeSingle();

  const openaiApiKey = asNonEmptyString(openaiKey?.api_key);
  const openaiModelName = asNonEmptyString(openaiKey?.ai_model_name);

  if (openaiApiKey) {
    const rawModel = openaiModelName || 'gpt-5.4';
    const model = validateModel('openai', rawModel);
    return { provider: 'openai', apiKey: openaiApiKey, model };
  }

  const { data: googleKey } = await supabase
    .from('platform_global_api_keys')
    .select('api_key, ai_model_name')
    .eq('service_name', 'gemini')
    .eq('is_active', true)
    .maybeSingle();

  const googleApiKey = asNonEmptyString(googleKey?.api_key);
  const googleModelName = asNonEmptyString(googleKey?.ai_model_name);

  if (googleApiKey) {
    const rawModel = googleModelName || 'gemini-3-flash';
    const model = validateModel('google', rawModel);
    return { provider: 'google', apiKey: googleApiKey, model };
  }

  return null;
}

const TASK_ROUTING: Record<AITaskType, { service: string; provider: AIProvider; fallbackModel: string }> = {
  tutorial_generation: { service: 'claude', provider: 'anthropic', fallbackModel: 'claude-sonnet-4-6' },
  content_writing:     { service: 'claude', provider: 'anthropic', fallbackModel: 'claude-sonnet-4-6' },
  narration:           { service: 'claude', provider: 'anthropic', fallbackModel: 'claude-sonnet-4-6' },
  shot_classification: { service: 'gemini', provider: 'google',    fallbackModel: 'gemini-3-flash' },
  review_insights:     { service: 'gemini', provider: 'google',    fallbackModel: 'gemini-3.1-pro' },
};

export async function resolveAIConfigForTask(
  supabase: SupabaseClientLike,
  taskType: AITaskType,
): Promise<AIProviderConfig | null> {
  const routing = TASK_ROUTING[taskType];
  if (!routing) return null;

  const { data: key } = await supabase
    .from('platform_global_api_keys')
    .select('api_key, ai_model_name')
    .eq('service_name', routing.service)
    .eq('is_active', true)
    .maybeSingle();

  const taskApiKey = asNonEmptyString(key?.api_key);
  const taskModelName = asNonEmptyString(key?.ai_model_name);

  if (taskApiKey) {
    const rawModel = taskModelName || routing.fallbackModel;
    const model = validateModel(routing.provider, rawModel);
    return { provider: routing.provider, apiKey: taskApiKey, model };
  }

  return null;
}

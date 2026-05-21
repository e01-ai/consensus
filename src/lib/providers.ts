/** Provider presets + endpoint normalization + thinking-disable knobs. */

export interface ProviderDef {
  id: string
  name: string
  endpoint: string
  defaultModel: string
  /** Curated suggestions surfaced under the model input. */
  modelSuggestions: string[]
  keyHint: string
  keyUrl?: string
  keyUrlLabel?: string
  /** Built-in shared key (only z.ai presets in this build). */
  builtinKey?: string
  /** Whether the user may freely edit the endpoint URL. */
  endpointEditable?: boolean
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'zai-highspeed',
    name: 'z.ai · highspeed',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-5.1-highspeed',
    modelSuggestions: ['glm-5.1-highspeed'],
    keyHint: 'paste z.ai / bigmodel key',
    keyUrl: 'https://open.bigmodel.cn',
    keyUrlLabel: 'bigmodel',
  },
  {
    id: 'zai-glm51',
    name: 'z.ai · GLM-5.1',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-5.1',
    modelSuggestions: ['glm-5.1', 'glm-4.5'],
    keyHint: 'paste z.ai / bigmodel key',
    keyUrl: 'https://open.bigmodel.cn',
    keyUrlLabel: 'bigmodel',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
    defaultModel: 'accounts/fireworks/routers/kimi-k2p6-turbo',
    modelSuggestions: [
      'accounts/fireworks/routers/kimi-k2p6-turbo',
      'accounts/fireworks/models/kimi-k2-instruct',
      'accounts/fireworks/models/deepseek-v3p2',
      'accounts/fireworks/models/llama4-maverick-instruct-basic',
    ],
    keyHint: 'paste Fire Pass key',
    keyUrl: 'https://app.fireworks.ai/fire-pass',
    keyUrlLabel: 'Fire Pass',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'z-ai/glm-4.6',
    modelSuggestions: [
      'z-ai/glm-4.6',
      'moonshotai/kimi-k2',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat',
      'x-ai/grok-4-fast',
    ],
    keyHint: 'paste OpenRouter key',
    keyUrl: 'https://openrouter.ai/keys',
    keyUrlLabel: 'OpenRouter',
  },
  {
    id: 'custom',
    name: 'Custom · OpenAI-compat',
    endpoint: '',
    defaultModel: '',
    modelSuggestions: [],
    keyHint: 'paste API key (if needed)',
    endpointEditable: true,
  },
]

export function getProvider(id: string): ProviderDef {
  return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]
}

/** Append /chat/completions if user pasted a base URL. */
export function normalizeEndpoint(url: string): string {
  if (!url) return url
  const cleaned = url.trim().replace(/\/+$/, '')
  if (/\/chat\/completions$/.test(cleaned)) return cleaned
  if (/\/v\d+$/.test(cleaned)) return cleaned + '/chat/completions'
  return cleaned
}

/** Per-provider knobs to discourage chain-of-thought / reasoning streams.
 *  Unknown fields are ignored by OpenAI-compat servers, so over-sending is safe
 *  — except for providers we know reject specific shapes (Fireworks rejects
 *  bool `thinking`, etc.) so each branch is hand-tuned. */
export function disableThinkingParams(endpoint: string): Record<string, unknown> {
  const u = (endpoint || '').toLowerCase()
  const out: Record<string, unknown> = {}

  if (/bigmodel\.cn|z\.ai/.test(u)) {
    out.thinking = { type: 'disabled' }
  }
  if (/fireworks\.ai/.test(u)) {
    out.reasoning_effort = 'low'
  }
  if (/openrouter\.ai/.test(u)) {
    out.reasoning = { exclude: true, max_tokens: 0 }
  }
  return out
}

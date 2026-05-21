/** Persisted user state (active provider, keys per-provider, custom overrides). */

import { PROVIDERS, getProvider } from './providers'

export interface SwarmState {
  activeProviderId: string
  /** Active model id (may diverge from provider's default — user edit). */
  activeModelId: string
  /** Per-provider key slots. */
  keys: Record<string, string>
  /** Per-provider custom endpoint override (only Custom is editable today). */
  endpoints: Record<string, string>
  /** Per-provider model override (resolves to provider.defaultModel otherwise). */
  models: Record<string, string>
  /** Per-provider: allow model to use reasoning (skip the "thinking-off" knob).
   *  Needed for OpenRouter models that error with "reasoning is mandatory". */
  allowReasoning: Record<string, boolean>
}

const STORAGE_KEY = 'swarm.state.v3'

function fallbackState(): SwarmState {
  const def = PROVIDERS[0]
  return {
    activeProviderId: def.id,
    activeModelId: def.defaultModel,
    keys: {},
    endpoints: {},
    models: {},
    allowReasoning: {},
  }
}

export function loadState(): SwarmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const j = JSON.parse(raw) as Partial<SwarmState>
      const provider = getProvider(j.activeProviderId || '')
      return {
        activeProviderId: provider.id,
        activeModelId: j.activeModelId || j.models?.[provider.id] || provider.defaultModel,
        keys: { ...(j.keys || {}) },
        endpoints: { ...(j.endpoints || {}) },
        models: { ...(j.models || {}) },
        allowReasoning: { ...(j.allowReasoning || {}) },
      }
    }
    // Migrate v2 (single-config) → v3 if present
    const v2raw = localStorage.getItem('swarm.cfg.v2')
    if (v2raw) {
      const v2 = JSON.parse(v2raw)
      const state = fallbackState()
      const preset = v2.preset && getProvider(v2.preset).id === v2.preset ? v2.preset : state.activeProviderId
      state.activeProviderId = preset
      state.activeModelId = v2.model || state.activeModelId
      state.keys = { ...(v2.keys || {}) }
      if (v2.key) state.keys[preset] = v2.key
      if (v2.endpoint) state.endpoints[preset] = v2.endpoint
      if (v2.model) state.models[preset] = v2.model
      saveState(state)
      return state
    }
  } catch { /* ignore */ }
  return fallbackState()
}

export function saveState(s: SwarmState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

/** Resolve the effective endpoint/model/key triple for the active provider. */
export function resolveActive(s: SwarmState) {
  const provider = getProvider(s.activeProviderId)
  const endpoint = s.endpoints[provider.id] || provider.endpoint
  const model = s.activeModelId || s.models[provider.id] || provider.defaultModel
  const key = s.keys[provider.id] || provider.builtinKey || ''
  const allowReasoning = !!s.allowReasoning?.[provider.id]
  return { provider, endpoint, model, key, allowReasoning }
}

import { useCallback, useState } from 'react'
import { PROVIDERS, normalizeEndpoint, type ProviderDef } from '../lib/providers'
import type { SwarmState } from '../lib/store'
import './ProviderModal.css'

interface Props {
  state: SwarmState
  onUpdate: (state: SwarmState) => void
  onClose: () => void
}

export function ProviderModal({ state, onUpdate, onClose }: Props) {
  const [draft, setDraft] = useState<SwarmState>(() => ({
    activeProviderId: state.activeProviderId,
    activeModelId:    state.activeModelId,
    keys:             { ...state.keys },
    endpoints:        { ...state.endpoints },
    models:           { ...state.models },
    allowReasoning:   { ...state.allowReasoning },
  }))
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState('')

  const activeProvider = PROVIDERS.find(p => p.id === draft.activeProviderId) || PROVIDERS[0]

  const setActiveProvider = useCallback((p: ProviderDef) => {
    setDraft(prev => ({
      ...prev,
      activeProviderId: p.id,
      activeModelId: prev.models[p.id] || p.defaultModel,
    }))
    setManualOpen(false); setManualValue('')
  }, [])

  const setKey = useCallback((pid: string, v: string) => {
    setDraft(prev => ({ ...prev, keys: { ...prev.keys, [pid]: v } }))
  }, [])

  const setEndpoint = useCallback((pid: string, v: string) => {
    setDraft(prev => ({ ...prev, endpoints: { ...prev.endpoints, [pid]: v } }))
  }, [])

  const pickModel = useCallback((pid: string, modelId: string) => {
    setDraft(prev => ({
      ...prev,
      activeProviderId: pid,
      activeModelId: modelId,
      models: { ...prev.models, [pid]: modelId },
    }))
    setManualOpen(false)
  }, [])

  const handleManualSubmit = useCallback(() => {
    const id = manualValue.trim()
    if (!id) return
    pickModel(draft.activeProviderId, id)
    setManualValue('')
  }, [manualValue, pickModel, draft.activeProviderId])

  const handleSave = useCallback(() => {
    const out: SwarmState = { ...draft }
    // normalize custom endpoint on save
    for (const pid of Object.keys(out.endpoints)) {
      const v = out.endpoints[pid]
      if (v) out.endpoints[pid] = normalizeEndpoint(v)
    }
    onUpdate(out)
    onClose()
  }, [draft, onUpdate, onClose])

  const keyStatus = (p: ProviderDef): 'none' | 'set' | 'active' => {
    const k = draft.keys[p.id] || p.builtinKey || ''
    if (!k || k.length < 4) return 'none'
    if (p.id === draft.activeProviderId) return 'active'
    return 'set'
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={e => e.stopPropagation()}>
        <div className="pm-header">
          <h2 className="pm-title">Endpoint &amp; Model</h2>
          <button className="pm-close" onClick={onClose}>&times;</button>
        </div>

        <div className="pm-body">
          <div className="pm-cards">
            {PROVIDERS.map(p => {
              const isActive = p.id === draft.activeProviderId
              const status = keyStatus(p)
              const endpoint = draft.endpoints[p.id] || p.endpoint
              const key = draft.keys[p.id] ?? ''
              const placeholder = p.builtinKey && !key ? '(built-in key in use — paste to override)' : p.keyHint

              return (
                <div
                  key={p.id}
                  className={`pm-card ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveProvider(p)}
                >
                  <div className="pm-card-header">
                    <div className="pm-card-name-row">
                      <span className={`pm-card-dot ${status}`} />
                      <span className="pm-card-name">{p.name}</span>
                      {p.endpointEditable && <span className="pm-card-tag">OpenAI-compat</span>}
                      {p.builtinKey && <span className="pm-card-tag accent">shared key</span>}
                    </div>
                    {isActive && <span className="pm-card-active-badge">ACTIVE</span>}
                  </div>

                  {isActive && p.endpointEditable && (
                    <div className="pm-card-endpoint-row" onClick={e => e.stopPropagation()}>
                      <span className="pm-endpoint-label">URL</span>
                      <input
                        type="text"
                        className="pm-key-input"
                        value={endpoint}
                        onChange={e => setEndpoint(p.id, e.target.value)}
                        placeholder="https://api.example.com/v1/chat/completions"
                        spellCheck={false}
                      />
                    </div>
                  )}
                  {isActive && !p.endpointEditable && (
                    <div className="pm-card-endpoint-row pm-readonly" onClick={e => e.stopPropagation()}>
                      <span className="pm-endpoint-label">URL</span>
                      <code className="pm-endpoint-readonly">{endpoint}</code>
                    </div>
                  )}

                  <div className="pm-card-key-row" onClick={e => e.stopPropagation()}>
                    <input
                      type="password"
                      className="pm-key-input"
                      value={key}
                      onChange={e => setKey(p.id, e.target.value)}
                      placeholder={placeholder}
                      spellCheck={false}
                    />
                    {p.keyUrl && (
                      <a
                        className="pm-key-link"
                        href={p.keyUrl}
                        target="_blank"
                        rel="noopener"
                        onClick={e => e.stopPropagation()}
                      >
                        {p.keyUrlLabel} &rarr;
                      </a>
                    )}
                  </div>

                  {isActive && (
                    <div className="pm-card-models" onClick={e => e.stopPropagation()}>
                      {p.modelSuggestions.map(mid => (
                        <button
                          key={mid}
                          className={`pm-model-btn ${draft.activeModelId === mid ? 'selected' : ''}`}
                          onClick={() => pickModel(p.id, mid)}
                          title={mid}
                        >
                          {mid.split('/').pop()}
                        </button>
                      ))}
                      {!manualOpen ? (
                        <button
                          className="pm-model-btn pm-manual-btn"
                          onClick={() => { setManualOpen(true); setManualValue(draft.activeModelId) }}
                        >
                          + custom id
                        </button>
                      ) : (
                        <div className="pm-manual-row">
                          <input
                            type="text"
                            className="pm-manual-input"
                            value={manualValue}
                            onChange={e => setManualValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                            placeholder="paste model id…"
                            spellCheck={false}
                            autoFocus
                          />
                          <button className="btn btn-primary pm-manual-go" onClick={handleManualSubmit}>use</button>
                        </div>
                      )}
                      {draft.activeModelId && !p.modelSuggestions.includes(draft.activeModelId) && (
                        <div className="pm-custom-model-active">
                          using: <span className="pm-custom-model-id">{draft.activeModelId}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {isActive && (
                    <label className="pm-card-reasoning" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!draft.allowReasoning[p.id]}
                        onChange={e => setDraft(prev => ({
                          ...prev,
                          allowReasoning: { ...prev.allowReasoning, [p.id]: e.target.checked },
                        }))}
                      />
                      <span className="pm-card-reasoning-text">
                        allow reasoning
                        <span className="pm-card-reasoning-hint">
                          {p.id === 'openrouter'
                            ? 'tick if model errors with "reasoning is mandatory"'
                            : 'tick to let model think (defeats "thinking-off" knob)'}
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="pm-footer">
          <div className="pm-footer-info">
            <span className="pm-footer-provider">{activeProvider.name}</span>
            <span className="pm-footer-sep">/</span>
            <span className="pm-footer-model">{draft.activeModelId || '(no model)'}</span>
          </div>
          <div className="pm-footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

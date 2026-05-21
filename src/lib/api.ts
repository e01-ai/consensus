import { disableThinkingParams } from './providers'

export interface StreamArgs {
  endpoint: string
  apiKey: string
  model: string
  sys: string
  user: string
  signal?: AbortSignal
  maxTokens?: number
  temperature?: number
  /** If true, skip the per-provider thinking-off knobs (let model reason). */
  allowReasoning?: boolean
  onChunk: (chunk: string) => void
}

/** Strip provider-specific control tokens that occasionally leak into delta. */
function stripSpecials(s: string): string {
  return s.replace(/<\|(?:end|endoftext|im_end|return|eot|user|assistant|system)\|>/g, '')
}

/** OpenAI-compatible streaming chat completion. Handles SSE framing,
 *  429 retry with exponential backoff, and provider-specific thinking-off knobs. */
export async function streamChat(args: StreamArgs): Promise<void> {
  const {
    endpoint, apiKey, model,
    sys, user, signal,
    maxTokens = 600, temperature = 0.7,
    allowReasoning = false,
    onChunk,
  } = args

  if (!endpoint) throw new Error('No endpoint configured')
  if (!model)    throw new Error('No model configured')

  const body: Record<string, unknown> = {
    model,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
    ...(allowReasoning ? {} : disableThinkingParams(endpoint)),
  }

  let res: Response | undefined
  const MAX_ATTEMPTS = 6
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
    if (res.status !== 429 && res.status !== 503) break

    // Honor server-provided Retry-After when present (seconds OR http-date).
    let wait = 0
    const ra = res.headers.get('retry-after')
    if (ra) {
      const sec = Number(ra)
      if (Number.isFinite(sec) && sec > 0) {
        wait = Math.min(30_000, sec * 1000)
      } else {
        const t = Date.parse(ra)
        if (!Number.isNaN(t)) wait = Math.max(0, Math.min(30_000, t - Date.now()))
      }
    }
    // Fallback: jittered exponential backoff, baseline 900ms.
    if (!wait) wait = 900 * Math.pow(2, attempt) + Math.random() * 500
    // Drain body to free the connection before we sleep.
    try { await res.body?.cancel() } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, wait))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  }
  if (!res) throw new Error('No response')
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${t.slice(0, 200)}`)
  }
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split(/\r?\n/)
    buf = lines.pop() || ''
    for (const ln of lines) {
      const line = ln.trim()
      if (!line || !line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const j = JSON.parse(data)
        const delta = j?.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) onChunk(stripSpecials(delta))
      } catch { /* swallow parse glitches mid-stream */ }
    }
  }
}

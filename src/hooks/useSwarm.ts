import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '../lib/api'
import { detectLang, type Lang } from '../lib/lang'
import { colorForIdx } from '../lib/markdown'
import {
  DEFAULT_N_ROLES, DEFAULT_BATCH_SIZE, DEFAULT_QPS,
  spawnPrompt, batchPrompt, consolidatePrompt,
} from '../lib/prompts'
import type {
  Card, ConsolidatorState, Phase, PhaseState, Role, SwarmSnapshot,
} from '../lib/swarm-types'

interface UseSwarmArgs {
  endpoint: string
  apiKey: string
  model: string
  allowReasoning?: boolean
  nRoles?: number
  batchSize?: number
  qps?: number
}

const RENDER_CPS = 90
const RENDER_CPS_BURST = 220
const TICK_INTERVAL_MS = 180

/** Internal mutable card — uses a hidden render queue (raw chars not yet flushed
 *  to the UI). Public Card type exposes only what components render. */
interface MutCard extends Card {
  queue: string
  apiDone: boolean
  apiErr: Error | null
  tpsWindow: { t: number; n: number }[]
  nextSegId: number
}

interface InternalState {
  phase: Phase
  phaseStates: [PhaseState, PhaseState, PhaseState]
  roles: Role[]
  spawnLines: { idx: number; name: string; brief: string }[]
  spawnPreview: string
  spawnOpen: boolean
  cards: MutCard[]
  cons: ConsolidatorState
  peakTps: number
  runStart: number
  runEnd: number
  tpsHistory: number[]
  isRunning: boolean
  errMsg: string
  lang: Lang
}

const TPS_HISTORY_LEN = 60   // 60 samples × 180ms ≈ 11s window
const SEGMENT_KEEP    = 80   // max segments retained per card

function makeInitial(): InternalState {
  return {
    phase: 0,
    phaseStates: ['idle', 'idle', 'idle'],
    roles: [],
    spawnLines: [],
    spawnPreview: '',
    spawnOpen: false,
    cards: [],
    cons: { state: 'idle', text: '', label: 'awaiting swarm' },
    peakTps: 0,
    runStart: 0,
    runEnd: 0,
    tpsHistory: [],
    isRunning: false,
    errMsg: '',
    lang: 'en',
  }
}

export function useSwarm(cfg: UseSwarmArgs) {
  const internalRef = useRef<InternalState>(makeInitial())
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const abortRef = useRef<AbortController | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const tickerRef = useRef<number | null>(null)

  const [snapshot, setSnapshot] = useState<SwarmSnapshot>(() => buildSnapshot(internalRef.current))

  const publish = useCallback(() => {
    setSnapshot(buildSnapshot(internalRef.current))
  }, [])

  const setErr = useCallback((msg: string) => {
    internalRef.current.errMsg = msg
    publish()
  }, [publish])

  // ── RAF: drain per-card queues at controlled cps ──
  const renderTick = useCallback((now: number) => {
    const s = internalRef.current
    const dt = Math.min(0.1, (now - lastTickRef.current) / 1000)
    lastTickRef.current = now
    let anyActive = false
    for (const c of s.cards) {
      if (c.state !== 'streaming') continue
      anyActive = true
      if (c.queue.length === 0) {
        if (c.apiDone) {
          if (c.apiErr) {
            if (c.apiErr.name === 'AbortError') {
              c.state = 'queued'
            } else {
              c.state = 'err'
              c.errMsg = c.apiErr.message
            }
          } else if (c.text.trim().length === 0) {
            c.state = 'err'
            c.errMsg = 'skipped by model'
          } else {
            c.doneAt = performance.now()
            c.state = 'done'
          }
        }
        continue
      }
      let cps = RENDER_CPS
      if (c.queue.length > 80)  cps = RENDER_CPS_BURST * 0.6
      if (c.queue.length > 200) cps = RENDER_CPS_BURST
      let take = Math.max(1, Math.floor(cps * dt))
      take = Math.min(take, c.queue.length)
      const piece = c.queue.slice(0, take)
      c.queue = c.queue.slice(take)
      c.visibleText += piece
      // append segment for spark animation; cap retained segments
      c.segments.push({ id: c.nextSegId++, text: piece })
      if (c.segments.length > SEGMENT_KEEP) {
        c.segments.splice(0, c.segments.length - SEGMENT_KEEP)
      }
      const n = Math.max(1, Math.ceil(piece.length / 3.5))
      c.tokens += n
      const tNow = performance.now()
      c.tpsWindow.push({ t: tNow, n })
      while (c.tpsWindow.length && tNow - c.tpsWindow[0].t > 1500) c.tpsWindow.shift()
      const elapsed = c.tpsWindow.length ? (tNow - c.tpsWindow[0].t) / 1000 : 1
      const total = c.tpsWindow.reduce((a, b) => a + b.n, 0)
      c.tps = elapsed > 0 ? Math.round(total / elapsed) : 0
      if (c.tps > c.peakTps) c.peakTps = c.tps
    }
    if (anyActive) {
      rafRef.current = requestAnimationFrame(renderTick)
    } else {
      rafRef.current = null
    }
  }, [])

  const startRenderLoop = useCallback(() => {
    if (rafRef.current != null) return
    lastTickRef.current = performance.now()
    rafRef.current = requestAnimationFrame(renderTick)
  }, [renderTick])

  // ── Public-facing tick: recompute totals + push snapshot at ~5Hz ──
  useEffect(() => {
    tickerRef.current = window.setInterval(() => {
      const s = internalRef.current
      const now = performance.now()
      let total = 0
      for (const c of s.cards) {
        while (c.tpsWindow.length && now - c.tpsWindow[0].t > 1500) c.tpsWindow.shift()
        if (c.tpsWindow.length === 0 && c.state !== 'streaming') c.tps = 0
        total += c.tps
      }
      if (total > s.peakTps) s.peakTps = total
      // record TPS history while running (or until full decay after stop)
      if (s.isRunning || total > 0 || s.tpsHistory[s.tpsHistory.length - 1] !== 0) {
        s.tpsHistory.push(total)
        if (s.tpsHistory.length > TPS_HISTORY_LEN) {
          s.tpsHistory.splice(0, s.tpsHistory.length - TPS_HISTORY_LEN)
        }
      }
      publish()
    }, TICK_INTERVAL_MS)
    return () => {
      if (tickerRef.current != null) window.clearInterval(tickerRef.current)
    }
  }, [publish])

  // ── PHASE 1 ──
  const spawnRoles = useCallback(async (question: string, signal: AbortSignal) => {
    const s = internalRef.current
    s.phase = 1
    s.phaseStates = ['active', 'idle', 'idle']
    s.spawnOpen = true
    s.spawnLines = []
    s.spawnPreview = ''
    s.roles = []
    publish()

    const nRoles = cfgRef.current.nRoles ?? DEFAULT_N_ROLES
    const sys = spawnPrompt(nRoles, s.lang)
    const user = `QUESTION: ${question}\n\nGenerate ${nRoles} diverse expert personas tailored to this question.`

    let buf = ''
    await streamChat({
      endpoint: cfgRef.current.endpoint,
      apiKey:   cfgRef.current.apiKey,
      model:    cfgRef.current.model,
      allowReasoning: cfgRef.current.allowReasoning,
      sys, user, signal,
      maxTokens: 10000, temperature: 0.85,
      onChunk: chunk => {
        buf += chunk
        s.spawnPreview = buf.slice(-500)
        const parts = buf.split('\n')
        buf = parts.pop() || ''
        for (const raw of parts) {
          const line = raw.trim()
          if (!line) continue
          const cleaned = line.replace(/^\s*(?:\d+[.)]\s*|[-*]\s*)/, '')
          const idx = cleaned.indexOf('|')
          if (idx < 0) continue
          const name = cleaned.slice(0, idx).trim()
          const brief = cleaned.slice(idx + 1).trim()
          if (!name || !brief) continue
          if (s.roles.length >= nRoles) continue
          const role: Role = { name, brief }
          s.roles.push(role)
          s.spawnLines.push({ idx: s.roles.length, name, brief })
        }
        publish()
      },
    })

    const tail = buf.trim()
    if (tail && s.roles.length < nRoles) {
      const idx = tail.indexOf('|')
      if (idx > 0) {
        const name = tail.slice(0, idx).trim()
        const brief = tail.slice(idx + 1).trim()
        if (name && brief) {
          s.roles.push({ name, brief })
          s.spawnLines.push({ idx: s.roles.length, name, brief })
        }
      }
    }
    s.spawnPreview = ''
    if (s.roles.length === 0) throw new Error('no roles parsed from spawn step')
    s.phaseStates = ['done', 'idle', 'idle']
    publish()
  }, [publish])

  // ── PHASE 2 ──
  const buildCards = useCallback(() => {
    const s = internalRef.current
    s.cards = s.roles.map((r, i): MutCard => ({
      role: r,
      idx: i,
      color: colorForIdx(i),
      text: '',
      visibleText: '',
      segments: [],
      tps: 0,
      peakTps: 0,
      tokens: 0,
      state: 'queued',
      startAt: 0,
      doneAt: 0,
      queue: '',
      apiDone: false,
      apiErr: null,
      tpsWindow: [],
      nextSegId: 0,
    }))
    publish()
  }, [publish])

  const runBatch = useCallback(async (batchIdx: number, batch: MutCard[], question: string, signal: AbortSignal) => {
    const s = internalRef.current
    for (const c of batch) {
      c.text = ''; c.visibleText = ''; c.tokens = 0; c.tps = 0; c.peakTps = 0
      c.startAt = performance.now()
      c.queue = ''; c.apiDone = false; c.apiErr = null
      c.state = 'streaming'
      c.tpsWindow = []
      c.segments = []
      c.nextSegId = 0
    }
    publish()
    startRenderLoop()

    const personaBlock = batch.map((c, i) =>
      `<§${i + 1}§> ${c.role.name} — angle: ${c.role.brief}`
    ).join('\n')

    const sys = batchPrompt(batch.length, s.lang)
    const user = `Question: ${question}\n\nPersonas:\n${personaBlock}\n\nRespond as all ${batch.length} personas in order, each prefixed by its marker.`

    let tail = ''
    let activeSub = -1

    const routeText = (text: string) => {
      if (!text) return
      if (activeSub < 0 || activeSub >= batch.length) return
      batch[activeSub].queue += text
      batch[activeSub].text  += text
    }
    const processIncoming = (chunk: string) => {
      tail += chunk
      while (true) {
        const m = tail.match(/<§\s*(\d+)\s*§>/)
        if (m) {
          if (m.index! > 0) routeText(tail.slice(0, m.index))
          activeSub = parseInt(m[1]) - 1
          tail = tail.slice(m.index! + m[0].length)
          if (tail.startsWith('\n')) tail = tail.slice(1)
          continue
        }
        const safeLen = Math.max(0, tail.length - 8)
        if (safeLen > 0) {
          routeText(tail.slice(0, safeLen))
          tail = tail.slice(safeLen)
        }
        break
      }
    }

    try {
      await streamChat({
        endpoint: cfgRef.current.endpoint,
        apiKey:   cfgRef.current.apiKey,
        model:    cfgRef.current.model,
        sys, user, signal,
        maxTokens: 260 * batch.length,
        temperature: 0.78,
        onChunk: processIncoming,
      })
      if (tail) { routeText(tail); tail = '' }
      for (const c of batch) c.apiDone = true
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      for (const c of batch) { c.apiDone = true; c.apiErr = err }
      if (err.name !== 'AbortError') setErr(`batch ${batchIdx + 1}: ${err.message}`)
    }
  }, [publish, startRenderLoop, setErr])

  // ── PHASE 3 ──
  const consolidate = useCallback(async (question: string, signal: AbortSignal) => {
    const s = internalRef.current
    s.phase = 3
    s.phaseStates = ['done', 'done', 'active']
    s.cons = { state: 'streaming', text: '', label: 'synthesizing' }
    publish()

    const done = s.cards.filter(c => c.state === 'done' && c.text.trim())
    s.cons.label = `synthesizing · ${done.length}/${s.cards.length}`

    const dossier = done.map(c => {
      const txt = c.text.trim().replace(/\s+/g, ' ').slice(0, 360)
      return `[#${String(c.idx + 1).padStart(2, '0')} ${c.role.name}] ${txt}`
    }).join('\n')

    const sys = consolidatePrompt(s.lang)
    const user = `QUESTION: ${question}\n\nAGENT DOSSIER (${done.length} agents):\n${dossier}\n\nProduce the consolidated answer now.`

    try {
      await streamChat({
        endpoint: cfgRef.current.endpoint,
        apiKey:   cfgRef.current.apiKey,
        model:    cfgRef.current.model,
        sys, user, signal,
        maxTokens: 1200, temperature: 0.4,
        onChunk: chunk => {
          s.cons.text += chunk
          // publish handled by ticker; no need per-chunk
        },
      })
      s.cons.state = 'done'
      s.cons.label = 'merged'
      s.phaseStates = ['done', 'done', 'done']
      publish()
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (err.name === 'AbortError') {
        s.cons.state = 'cancelled'
        s.cons.label = 'cancelled'
      } else {
        s.cons.state = 'err'
        s.cons.label = 'error'
        setErr(err.message)
      }
      publish()
    }
  }, [publish, setErr])

  // ── ORCHESTRATOR ──
  const fire = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q) { setErr('type a question'); return }
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const s = internalRef.current
    Object.assign(s, makeInitial())
    s.lang = detectLang(q)
    s.runStart = performance.now()
    s.runEnd = 0
    s.tpsHistory = []
    s.isRunning = true
    s.phase = 1
    s.cons.label = 'awaiting swarm'
    s.cons.state = 'idle'
    publish()

    try {
      await spawnRoles(q, ctrl.signal)

      // collapse spawn box after a brief breath
      setTimeout(() => { s.spawnOpen = false; publish() }, 1200)

      s.phase = 2
      s.phaseStates = ['done', 'active', 'idle']
      buildCards()
      startRenderLoop()

      const batchSize = cfgRef.current.batchSize ?? DEFAULT_BATCH_SIZE
      const qps       = cfgRef.current.qps ?? DEFAULT_QPS
      const stagger   = 1000 / Math.max(0.1, qps)
      const batches: MutCard[][] = []
      for (let i = 0; i < s.cards.length; i += batchSize) {
        batches.push(s.cards.slice(i, i + batchSize))
      }
      await Promise.all(batches.map((b, i) => new Promise<void>(resolve => {
        setTimeout(async () => {
          if (ctrl.signal.aborted) { resolve(); return }
          await runBatch(i, b, q, ctrl.signal)
          resolve()
        }, i * stagger)
      })))

      // wait for raf to drain
      while (s.cards.some(c => c.state === 'streaming')) {
        if (ctrl.signal.aborted) break
        await new Promise(r => setTimeout(r, 80))
      }
      s.phaseStates = ['done', 'done', 'idle']
      publish()

      const okCount = s.cards.filter(c => c.state === 'done').length
      if (okCount < 3) {
        s.cons.state = 'err'
        s.cons.label = `not enough agents (${okCount})`
        publish()
      } else {
        await consolidate(q, ctrl.signal)
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (err.name !== 'AbortError') setErr(err.message)
    } finally {
      s.isRunning = false
      s.runEnd = performance.now()
      publish()
    }
  }, [spawnRoles, buildCards, runBatch, startRenderLoop, consolidate, publish, setErr])

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const s = internalRef.current
    s.isRunning = false
    if (!s.runEnd) s.runEnd = performance.now()
    publish()
  }, [publish])

  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort()
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])

  return { snapshot, fire, stop }
}

function buildSnapshot(s: InternalState): SwarmSnapshot {
  let totalTps = 0, totalTokens = 0, agentsActive = 0, doneCount = 0
  for (const c of s.cards) {
    totalTps += c.tps
    totalTokens += c.tokens
    if (c.state === 'streaming') agentsActive++
    if (c.state === 'done') doneCount++
  }
  const endTime = s.runEnd || (s.isRunning ? performance.now() : 0)
  const elapsed = s.runStart && endTime ? (endTime - s.runStart) / 1000 : 0
  return {
    phase: s.phase,
    phaseStates: s.phaseStates,
    roles: s.roles,
    spawnLines: s.spawnLines,
    spawnPreview: s.spawnPreview,
    spawnOpen: s.spawnOpen,
    cards: s.cards.map(c => ({
      role: c.role,
      idx: c.idx,
      color: c.color,
      text: c.text,
      visibleText: c.visibleText,
      segments: c.segments,
      tps: c.tps,
      peakTps: c.peakTps,
      tokens: c.tokens,
      state: c.state,
      errMsg: c.errMsg,
      startAt: c.startAt,
      doneAt: c.doneAt,
    })),
    cons: { ...s.cons },
    totalTps,
    peakTps: s.peakTps,
    totalTokens,
    agentsActive,
    doneCount,
    runStart: s.runStart,
    runEnd: s.runEnd,
    elapsed,
    tpsHistory: s.tpsHistory,
    isRunning: s.isRunning,
    errMsg: s.errMsg,
    lang: s.lang,
  }
}

export type Phase = 0 | 1 | 2 | 3
export type PhaseState = 'idle' | 'active' | 'done'
export type CardStateName = 'queued' | 'streaming' | 'done' | 'err'

export interface Role {
  name: string
  brief: string
}

export interface StreamSegment {
  id: number
  text: string
}

export interface Card {
  role: Role
  idx: number
  color: string
  text: string         // full streamed text from API (may be ahead of UI)
  visibleText: string  // chars actually drained to UI via raf ticker
  segments: StreamSegment[]  // per-flush chunks for spark animation
  tps: number
  peakTps: number
  tokens: number
  state: CardStateName
  errMsg?: string
  startAt: number
  doneAt: number
}

export interface ConsolidatorState {
  state: 'idle' | 'streaming' | 'done' | 'err' | 'cancelled'
  text: string
  label: string
}

export interface SwarmSnapshot {
  phase: Phase
  phaseStates: [PhaseState, PhaseState, PhaseState]
  roles: Role[]
  spawnLines: { idx: number; name: string; brief: string }[]
  spawnPreview: string
  spawnOpen: boolean
  cards: Card[]
  cons: ConsolidatorState
  totalTps: number
  peakTps: number
  totalTokens: number
  agentsActive: number
  doneCount: number
  runStart: number
  runEnd: number
  elapsed: number
  tpsHistory: number[]   // rolling samples of totalTps (oldest first)
  isRunning: boolean
  errMsg: string
  lang: 'zh' | 'en'
}

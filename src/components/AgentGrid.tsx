import type { Card } from '../lib/swarm-types'
import { AgentCard } from './AgentCard'
import './AgentGrid.css'

interface Props {
  cards: Card[]
  isRunning: boolean
  compact?: boolean
}

export function AgentGrid({ cards, isRunning, compact = false }: Props) {
  if (cards.length === 0) {
    return (
      <div className="agent-grid-empty">
        {isRunning ? (
          <div className="agent-grid-empty-inner">
            <span className="agent-grid-empty-dot" />
            spawning 50 roles…
          </div>
        ) : (
          <div className="agent-grid-empty-inner muted">
            ask a question — N personas answer in parallel, one synthesis comes back.
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={`agent-grid ${compact ? 'compact' : ''}`}>
      {cards.map(c => <AgentCard key={c.idx} card={c} />)}
    </div>
  )
}

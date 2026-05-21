import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Card } from '../lib/swarm-types'
import './AgentCard.css'

interface Props { card: Card }

export function AgentCard({ card }: Props) {
  const [expanded, setExpanded] = useState(false)
  const style = { '--c': card.color } as CSSProperties

  const tpsLabel =
    card.state === 'streaming' ? `${card.tps}t/s`
    : card.state === 'done'    ? `${card.tokens}t`
    : card.state === 'err'     ? 'err'
    : card.state === 'queued'  ? 'queued'
    : '—'

  const isExpandable = card.state === 'done' || card.state === 'streaming'

  let body: ReactNode
  if (card.state === 'err') {
    body = <span className="agent-card-err">{card.errMsg || 'error'}</span>
  } else if (card.segments.length > 0 || card.visibleText) {
    body = (
      <>
        {card.state === 'streaming'
          ? card.segments.map(seg => (
              <span key={seg.id} className="agent-card-seg">{seg.text}</span>
            ))
          : <span className="agent-card-text">{card.visibleText}</span>
        }
        {card.state === 'streaming' && <span className="agent-card-comet" />}
      </>
    )
  } else {
    body = <span className="agent-card-empty">{card.role.brief}</span>
  }

  // mini speed bar (0 → 200 tps)
  const speedPct = Math.min(100, (card.tps / 200) * 100)

  return (
    <div
      className={`agent-card ${card.state} ${expanded ? 'expanded' : ''}`}
      style={style}
      onClick={() => isExpandable && setExpanded(e => !e)}
    >
      <div className="agent-card-top">
        <span className="agent-card-dot" />
        <span className="agent-card-idx">#{String(card.idx + 1).padStart(2, '0')}</span>
        <span className="agent-card-name" title={`${card.role.name} — ${card.role.brief}`}>{card.role.name}</span>
        <span className="agent-card-tps">{tpsLabel}</span>
      </div>
      {(card.state === 'streaming' || card.state === 'done') && (
        <div className="agent-card-speedbar">
          <div className="agent-card-speedbar-fill" style={{ width: speedPct + '%' }} />
        </div>
      )}
      <div className="agent-card-body">{body}</div>
    </div>
  )
}

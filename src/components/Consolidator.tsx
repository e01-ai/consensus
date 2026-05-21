import { useEffect, useMemo, useRef } from 'react'
import type { ConsolidatorState } from '../lib/swarm-types'
import { renderMarkdown } from '../lib/markdown'
import './Consolidator.css'

interface Props {
  cons: ConsolidatorState
  doneCount: number
  totalCount: number
}

export function Consolidator({ cons, doneCount, totalCount }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const html = useMemo(() => renderMarkdown(cons.text), [cons.text])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    // auto-scroll to bottom while streaming
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20
    if (cons.state === 'streaming' || atBottom) el.scrollTop = el.scrollHeight
  }, [cons.text, cons.state])

  const isIdle = cons.state === 'idle'
  const isStreaming = cons.state === 'streaming'

  return (
    <aside className={`cons ${cons.state}`}>
      <div className="cons-head">
        <span className="cons-orb" />
        <span className="cons-title">consolidated answer</span>
        <span className="cons-label">{cons.label}</span>
        {totalCount > 0 && (
          <span className="cons-count">· {doneCount}/{totalCount} agents</span>
        )}
      </div>
      <div className="cons-body" ref={bodyRef}>
        {isIdle && !cons.text ? (
          <span className="cons-idle-text">fire to merge every perspective into one synthesis.</span>
        ) : (
          <>
            <div className="cons-rendered" dangerouslySetInnerHTML={{ __html: html }} />
            {isStreaming && <span className="cons-comet" />}
          </>
        )}
      </div>
    </aside>
  )
}

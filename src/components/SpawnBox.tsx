import { useEffect, useRef } from 'react'
import './SpawnBox.css'

interface Props {
  open: boolean
  lines: { idx: number; name: string; brief: string }[]
  preview: string
}

export function SpawnBox({ open, lines, preview }: Props) {
  const innerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = innerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  return (
    <div className={`spawnbox ${open ? 'open' : ''}`}>
      <div className="spawnbox-inner" ref={innerRef}>
        {lines.map(l => (
          <span key={l.idx} className="spawn-line">
            <b>#{String(l.idx).padStart(2, '0')}</b>
            <span className="spawn-name">{l.name}</span>
            <span className="spawn-brief">{l.brief}</span>
          </span>
        ))}
        {preview && <div className="spawn-pre">{preview}</div>}
      </div>
    </div>
  )
}

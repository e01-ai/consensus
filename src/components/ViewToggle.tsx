import './ViewToggle.css'

interface Props {
  view: 'swarm' | 'result'
  onChange: (v: 'swarm' | 'result') => void
}

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="viewtoggle">
      <span className="viewtoggle-label">view</span>
      <div className="viewtoggle-segs">
        <button
          className={`viewtoggle-seg ${view === 'swarm' ? 'active' : ''}`}
          onClick={() => onChange('swarm')}
        >
          <span className="viewtoggle-icon">▦</span>
          swarm
        </button>
        <button
          className={`viewtoggle-seg ${view === 'result' ? 'active' : ''}`}
          onClick={() => onChange('result')}
        >
          <span className="viewtoggle-icon">▤</span>
          result
        </button>
      </div>
    </div>
  )
}

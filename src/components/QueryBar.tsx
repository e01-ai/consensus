import { useState, useEffect, useRef } from 'react'
import './QueryBar.css'

const EXAMPLES = [
  'Design a city that solves loneliness.',
  'Why is interpretability the hardest open problem in AI?',
  'If money were physical, what would it look like in 2040?',
  'How would an octopus design social media?',
  'Argue both sides of remote work, then take one.',
  'Build a constitution for a Mars colony.',
  'Will note-taking apps survive AI assistants?',
  'Why did Concorde fail — and what would un-fail it?',
  'When does optimization become a vice?',
  'Pitch a religion invented by accountants.',
  'What changes if humans could hibernate three months a year?',
  'Is taste teachable, or only catchable?',
]

export interface SwarmConfig {
  nRoles: number
  batchSize: number
  qps: number
}

interface Props {
  isRunning: boolean
  onFire: (q: string) => void
  onStop: () => void
  hero?: boolean
  config: SwarmConfig
  onConfigChange: (c: SwarmConfig) => void
}

const N_OPTIONS = [10, 25, 50, 75, 100]
const BATCH_OPTIONS = [3, 5, 8, 10]
const QPS_OPTIONS = [1, 2, 3, 5, 10]

export function QueryBar({ isRunning, onFire, onStop, hero = false, config, onConfigChange }: Props) {
  const [value, setValue] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit() {
    if (!value.trim() || isRunning) return
    onFire(value)
  }

  function cycle<T>(arr: T[], cur: T): T {
    const i = arr.indexOf(cur)
    return arr[(i + 1) % arr.length]
  }

  return (
    <>
      <div className={`qbar ${hero ? 'hero' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          spellCheck={false}
          placeholder="ask anything"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          disabled={isRunning}
        />
        <div className="qbar-chips">
          <button
            className="qbar-chip"
            onClick={() => onConfigChange({ ...config, nRoles: cycle(N_OPTIONS, config.nRoles) })}
            disabled={isRunning}
            title="agents to spawn"
          >
            <span className="qbar-chip-lbl">N</span><b>{config.nRoles}</b>
          </button>
          <button
            className="qbar-chip"
            onClick={() => onConfigChange({ ...config, batchSize: cycle(BATCH_OPTIONS, config.batchSize) })}
            disabled={isRunning}
            title="personas per request"
          >
            <span className="qbar-chip-lbl">B</span><b>{config.batchSize}</b>
          </button>
          <button
            className="qbar-chip"
            onClick={() => onConfigChange({ ...config, qps: cycle(QPS_OPTIONS, config.qps) })}
            disabled={isRunning}
            title="requests per second"
          >
            <span className="qbar-chip-lbl">QPS</span><b>{config.qps}</b>
          </button>
          <button
            className={`qbar-chip qbar-chip-toggle ${showExamples ? 'on' : ''}`}
            onClick={() => setShowExamples(v => !v)}
            title="example questions"
          >
            <span className="qbar-chip-lbl">ex</span>
            <span className="qbar-chip-caret">{showExamples ? '▾' : '▸'}</span>
          </button>
        </div>
        <button
          className="btn btn-primary qbar-fire"
          onClick={handleSubmit}
          disabled={isRunning || !value.trim()}
        >
          <span className="qbar-fire-icon">⚡</span>
          fire
        </button>
        {!hero && (
          <button className="btn btn-secondary" onClick={onStop} disabled={!isRunning}>
            stop
          </button>
        )}
      </div>

      {showExamples && (
        <div className="qbar-examples">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              className="qbar-ex"
              onClick={() => { setValue(ex); inputRef.current?.focus(); setShowExamples(false) }}
              disabled={isRunning}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

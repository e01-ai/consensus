import type { PhaseState } from '../lib/swarm-types'
import './InstrumentBar.css'

interface Props {
  phaseStates: [PhaseState, PhaseState, PhaseState]
  fanoutPct: number
  elapsed: number
  totalTokens: number
  doneCount: number
  agentsActive: number
  totalRoles: number
  totalTps: number
  peakTps: number
}

const LABELS = ['spawn', 'fan-out', 'consolidate']

export function InstrumentBar({
  phaseStates, fanoutPct,
  elapsed, totalTokens, doneCount, agentsActive, totalRoles, totalTps, peakTps,
}: Props) {
  return (
    <div className="instr">
      <div className="instr-phases">
        {LABELS.map((label, i) => {
          const st = phaseStates[i]
          let fill = 0
          let indet = false
          if (st === 'done') fill = 100
          else if (st === 'active') {
            if (i === 1) fill = Math.max(6, fanoutPct * 100)
            else indet = true
          }
          return (
            <div key={label} className={`instr-phase ${st}`}>
              <span className="instr-phase-label">{label}</span>
              <div className="instr-phase-track">
                {indet
                  ? <div className="instr-phase-fill indeterminate" />
                  : <div className="instr-phase-fill" style={{ width: fill + '%' }} />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="instr-stats">
        <span className="instr-stat"><b>{agentsActive}</b><span>live</span></span>
        <span className="instr-stat"><b>{doneCount}</b><span className="instr-stat-slash">/</span><span className="instr-stat-total">{totalRoles}</span><span>done</span></span>
        <span className="instr-stat"><b>{totalTokens}</b><span>tokens</span></span>
        <span className="instr-stat instr-stat-tps"><b>{totalTps}</b><span>t/s</span></span>
        <span className="instr-stat"><span>peak</span><b className="instr-stat-peak">{peakTps}</b></span>
        <span className="instr-stat instr-stat-elapsed"><b>{elapsed.toFixed(1)}</b><span>s</span></span>
      </div>
    </div>
  )
}

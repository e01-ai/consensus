import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header }         from './components/Header'
import { QueryBar, type SwarmConfig } from './components/QueryBar'
import { InstrumentBar }  from './components/InstrumentBar'
import { SpawnBox }       from './components/SpawnBox'
import { AgentGrid }      from './components/AgentGrid'
import { Consolidator }   from './components/Consolidator'
import { ViewToggle }     from './components/ViewToggle'
import { ProviderModal }  from './components/ProviderModal'
import { useSwarm }       from './hooks/useSwarm'
import { loadState, saveState, resolveActive, type SwarmState } from './lib/store'
import './styles/app.css'

type ViewMode = 'swarm' | 'result'

export function App() {
  const [state, setState] = useState<SwarmState>(() => loadState())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('swarm')
  const [config, setConfig] = useState<SwarmConfig>({ nRoles: 50, batchSize: 5, qps: 3 })
  const userOverrideRef = useRef(false)

  const { provider, endpoint, model, key } = useMemo(() => resolveActive(state), [state])
  const { snapshot, fire, stop } = useSwarm({
    endpoint, apiKey: key, model,
    nRoles: config.nRoles, batchSize: config.batchSize, qps: config.qps,
  })

  useEffect(() => {
    if (userOverrideRef.current) return
    if (snapshot.cons.state === 'streaming' || snapshot.cons.state === 'done') {
      setView('result')
    } else if (snapshot.cons.state === 'idle' && !snapshot.isRunning) {
      setView('swarm')
    }
  }, [snapshot.cons.state, snapshot.isRunning])

  const handleFire = useCallback((q: string) => {
    userOverrideRef.current = false
    setView('swarm')
    fire(q)
  }, [fire])

  const handleSetView = useCallback((v: ViewMode) => {
    userOverrideRef.current = true
    setView(v)
  }, [])

  const handleStateUpdate = useCallback((next: SwarmState) => {
    saveState(next)
    setState(next)
  }, [])

  const resultReady = snapshot.cons.state === 'streaming' || snapshot.cons.state === 'done' || snapshot.cons.state === 'cancelled' || snapshot.cons.state === 'err'
  const hasRun = snapshot.isRunning || snapshot.cards.length > 0

  return (
    <div className={`app-shell view-${view}`}>
      <Header
        providerName={provider.name}
        modelLabel={model}
        hasKey={!!key && key.length > 6}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <QueryBar
        isRunning={snapshot.isRunning}
        onFire={handleFire}
        onStop={stop}
        config={config}
        onConfigChange={setConfig}
      />

      {hasRun && (
        <InstrumentBar
          phaseStates={snapshot.phaseStates}
          fanoutPct={snapshot.cards.length > 0 ? snapshot.doneCount / snapshot.cards.length : 0}
          elapsed={snapshot.elapsed}
          totalTokens={snapshot.totalTokens}
          doneCount={snapshot.doneCount}
          agentsActive={snapshot.agentsActive}
          totalRoles={snapshot.cards.length}
          totalTps={snapshot.totalTps}
          peakTps={snapshot.peakTps}
        />
      )}

      <SpawnBox
        open={snapshot.spawnOpen}
        lines={snapshot.spawnLines}
        preview={snapshot.spawnPreview}
      />

      {resultReady && (
        <ViewToggle view={view} onChange={handleSetView} />
      )}

      <main className={`app-main view-${view}`}>
        <div className="app-grid-wrap">
          <AgentGrid cards={snapshot.cards} isRunning={snapshot.isRunning} compact={view === 'result'} />
        </div>
        <Consolidator
          cons={snapshot.cons}
          doneCount={snapshot.doneCount}
          totalCount={snapshot.cards.length}
        />
      </main>

      {settingsOpen && (
        <ProviderModal
          state={state}
          onUpdate={handleStateUpdate}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

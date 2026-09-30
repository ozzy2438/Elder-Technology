import { useEffect, useMemo, useRef, useState } from 'react'
import { PACKS, positionToHuman, resolvePack, runAnalysis } from '../engine/index.ts'
import type { EvidencePosition } from '../engine/types.ts'
import { Controls } from './Controls.tsx'
import { PaperStack } from './PaperStack.tsx'
import { EmptyState, Results } from './Results.tsx'

export function App() {
  const [packId, setPackId] = useState(PACKS[0].id)
  const pack = resolvePack(packId)
  const [providerRef, setProviderRef] = useState('PROV-UNSET')
  const [periodFrom, setPeriodFrom] = useState('2026-01-01')
  const [periodTo, setPeriodTo] = useState('2026-03-31')
  const [files, setFiles] = useState<File[]>([])
  const [position, setPosition] = useState<EvidencePosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [intakeSeen, setIntakeSeen] = useState(false)
  const storyRef = useRef<HTMLElement>(null)

  const human = useMemo(() => (position ? positionToHuman(position) : null), [position])

  useEffect(() => {
    document.title = `Evidence position — ${pack.label}`
    document.documentElement.lang = pack.locale
  }, [pack.label, pack.locale])

  useEffect(() => {
    if (!intakeSeen || !storyRef.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    storyRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [intakeSeen, position])

  async function analyse(
    nextFiles: File[] = files,
    ref = providerRef,
    from = periodFrom,
    to = periodTo,
    nextPackId = packId,
  ) {
    setBusy(true)
    setError(null)
    setIntakeSeen(false)
    try {
      const result = await runAnalysis({
        provider_ref: ref,
        period_from: from,
        period_to: to,
        files: nextFiles,
        pack_id: nextPackId,
      })
      setProviderRef(result.run.provider_ref)
      setPeriodFrom(result.run.period.from)
      setPeriodTo(result.run.period.to)
      setPosition(result)
      setIntakeSeen(true)
    } catch (err) {
      setPosition(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function onPick(list: FileList | null) {
    if (!list) return
    setFiles(Array.from(list))
    setPosition(null)
    setIntakeSeen(false)
  }

  function onPackChange(nextId: string) {
    setPackId(nextId)
    setFiles([])
    setPosition(null)
    setIntakeSeen(false)
    setError(null)
    setProviderRef('PROV-UNSET')
  }

  async function loadDemo() {
    const demo = pack.demo.files()
    setFiles(demo)
    setProviderRef(pack.demo.provider_ref)
    setPeriodFrom(pack.demo.period.from)
    setPeriodTo(pack.demo.period.to)
    setPosition(null)
    setIntakeSeen(false)
    await analyse(demo, pack.demo.provider_ref, pack.demo.period.from, pack.demo.period.to, packId)
  }

  async function loadDemoMissingOptional() {
    const demo = pack.demo.files().filter((f) => f.name !== pack.demo.drop_file)
    setFiles(demo)
    setProviderRef(pack.demo.provider_ref)
    setPeriodFrom(pack.demo.period.from)
    setPeriodTo(pack.demo.period.to)
    setPosition(null)
    setIntakeSeen(false)
    await analyse(demo, pack.demo.provider_ref, pack.demo.period.from, pack.demo.period.to, packId)
  }

  function downloadJson() {
    if (!position) return
    const blob = new Blob([JSON.stringify(position, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-position-${position.run.pack_id}-${position.run.provider_ref}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="desk">
      <a className="skip" href="#story">
        Skip to results
      </a>
      <header className="mast">
        <PaperStack />
        <div className="mast-copy">
          <p className="kicker">{pack.kicker}</p>
          <h1>Evidence position</h1>
          <p className="purpose">
            A calm read of your own exports: what the records show, where they point, and what is missing.
          </p>
          <p className="banner" role="note">
            {pack.banner}
          </p>
        </div>
      </header>

      <div className="layout">
        <Controls
          packs={PACKS}
          packId={packId}
          pack={pack}
          providerRef={providerRef}
          periodFrom={periodFrom}
          periodTo={periodTo}
          files={files}
          busy={busy}
          onPackChange={onPackChange}
          onProvider={setProviderRef}
          onFrom={setPeriodFrom}
          onTo={setPeriodTo}
          onPick={onPick}
          onRun={() => void analyse()}
          onDemo={() => void loadDemo()}
          onGap={() => void loadDemoMissingOptional()}
        />

        <main id="story" ref={storyRef} tabIndex={-1}>
          <p className="live" aria-live="polite">
            {busy ? 'Running intake.' : intakeSeen ? 'Evidence position is ready.' : ''}
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          {!position ? <EmptyState /> : null}

          {position && intakeSeen && human ? (
            <Results
              position={position}
              lead={human.lead}
              table={human.table}
              onDownload={downloadJson}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

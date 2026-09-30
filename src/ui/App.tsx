import { useEffect, useState } from 'react'
import { PACKS, resolvePack } from '../engine/index.ts'
import {
  analysePrepared,
  prepareIntake,
  type PreparedIntake,
  type RunInput,
} from '../engine/run.ts'
import type { EvidencePosition } from '../engine/types.ts'
import type { MappingOverride } from '../engine/parse.ts'
import { Intake } from './Intake.tsx'
import { Upload } from './Upload.tsx'
import { ExportDialog } from './ExportDialog.tsx'
import { Review } from './Review.tsx'
import {
  PlusIcon,
  CaretDownIcon,
  MoonIcon,
  SunIcon,
  ArrowRightIcon,
  FileTextIcon,
  InfoIcon,
} from './icons.ts'
import { reportText } from './presentation.ts'

export function App() {
  const [packId, setPackId] = useState(PACKS[0].id)
  const pack = resolvePack(packId)
  const [stage, setStage] = useState<'empty' | 'intake' | 'review'>('empty')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [draftFiles, setDraftFiles] = useState<File[]>([])
  const [provider, setProvider] = useState('')
  const [from, setFrom] = useState('2026-07-01')
  const [to, setTo] = useState('2026-09-30')
  const [prepared, setPrepared] = useState<PreparedIntake | null>(null)
  const [preparedInput, setPreparedInput] = useState<RunInput | null>(null)
  const [reviewInput, setReviewInput] = useState<RunInput | null>(null)
  const [reviewTables, setReviewTables] = useState<PreparedIntake | null>(null)
  const [position, setPosition] = useState<EvidencePosition | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportType, setExportType] = useState<'json' | 'txt' | null>(null)
  const [demo, setDemo] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('elder-theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('elder-theme', theme)
    } catch {
      /* Theme persistence is optional. */
    }
  }, [theme])
  useEffect(() => {
    document.title = `Elder — Evidence review · ${pack.market}`
    document.documentElement.lang = pack.locale
  }, [pack])
  function input(): RunInput {
    return {
      provider_ref: provider,
      period_from: from,
      period_to: to,
      files: draftFiles,
      pack_id: packId,
    }
  }
  async function inspect(next: RunInput) {
    setBusy(true)
    setError(null)
    try {
      const result = await prepareIntake(next)
      setPrepared(result)
      setPreparedInput(next)
      setStage('intake')
      setUploadOpen(false)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }
  async function applyMapping(source: string, mapping: MappingOverride) {
    if (!preparedInput) return false
    return await inspect({
      ...preparedInput,
      mappings: { ...preparedInput.mappings, [source]: mapping },
    })
  }
  function review() {
    if (!prepared || !preparedInput) return
    setBusy(true)
    setError(null)
    try {
      const result = analysePrepared(preparedInput, prepared)
      setPosition(result)
      setReviewInput(preparedInput)
      setReviewTables(prepared)
      setStage('review')
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  function openUpload() {
    const next = stage === 'intake' ? preparedInput : reviewInput
    if (next) {
      setDraftFiles(next.files)
      setProvider(next.provider_ref)
      setFrom(next.period_from)
      setTo(next.period_to)
    }
    setError(null)
    setUploadOpen(true)
  }
  function changePack(next: string) {
    setPackId(next)
    setStage('empty')
    setPosition(null)
    setPrepared(null)
    setPreparedInput(null)
    setReviewInput(null)
    setReviewTables(null)
    setDraftFiles([])
    setProvider('')
    setError(null)
    setDemo(false)
  }
  async function loadDemo() {
    const files = pack.demo.files()
    setDraftFiles(files)
    setProvider(pack.demo.provider_ref)
    setFrom(pack.demo.period.from)
    setTo(pack.demo.period.to)
    setDemo(true)
    await inspect({
      provider_ref: pack.demo.provider_ref,
      period_from: pack.demo.period.from,
      period_to: pack.demo.period.to,
      files,
      pack_id: pack.id,
    })
  }
  function download(type: 'json' | 'txt') {
    if (!position) return
    const content = type === 'json' ? JSON.stringify(position, null, 2) : reportText(position)
    const blob = new Blob([content], {
      type: type === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `evidence-review-${position.run.pack_id}-${position.run.provider_ref.replace(/[^a-zA-Z0-9_-]/g, '_')}.${type}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Native browser save prompts may take longer than a second to acquire the Blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <header className="app-header">
        <span className="wordmark">Elder</span>
        <div className="pack-context">
          <div className="country-select">
            <select
              aria-label="Country and programme"
              value={packId}
              disabled={busy}
              onChange={(e) => changePack(e.target.value)}
            >
              {PACKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.market}
                </option>
              ))}
            </select>
            <CaretDownIcon size={17} />
          </div>
          <span className="context-slash">/</span>
          <span className="programme">
            {packId === 'au-sah' ? 'Support at Home' : 'CQC homecare'}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button theme-toggle"
            aria-label={theme === 'light' ? 'Use dark theme' : 'Use light theme'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <MoonIcon size={21} /> : <SunIcon size={21} />}
          </button>
          <button
            className="button secondary header-add"
            aria-label="Add exports"
            onClick={openUpload}
            disabled={busy}
          >
            <PlusIcon size={23} />
            <span>Add exports</span>
          </button>
        </div>
      </header>
      <div className="sr-only" role="status" aria-live="polite">
        {busy
          ? 'Reading your exports.'
          : stage === 'intake'
            ? 'File intake ready to review.'
            : stage === 'review'
              ? 'Evidence review ready.'
              : ''}
      </div>
      {error && !uploadOpen ? (
        <p className="error global-error" role="alert">
          {error}
        </p>
      ) : null}
      {stage === 'empty' ? (
        <main id="main" className="empty-page">
          <p className="eyebrow">Evidence, made clear</p>
          <h1>
            Know what your
            <br />
            records can show.
          </h1>
          <p className="empty-description">
            Bring your exports together. Find the gaps,
            <br className="desktop-only" /> inspect the evidence, and see what to add next.
          </p>
          <div className="empty-actions">
            <button className="button primary" onClick={openUpload}>
              <PlusIcon size={23} />
              Add exports
            </button>
            <button className="button secondary" disabled={busy} onClick={() => void loadDemo()}>
              {busy ? 'Reading demo…' : 'Explore the demo'}
              <ArrowRightIcon size={20} />
            </button>
          </div>
          <div className="empty-explainer">
            <FileTextIcon size={24} weight="light" />
            <span>
              CSV & XLSX exports
              <span>Claims, delivery, plans, consent, competency, incidents and policies.</span>
            </span>
          </div>
          <p className="empty-privacy">
            Files stay in your browser. No sign-up. No data sent to an AI service.
          </p>
          <p className="scope-footer">
            <InfoIcon size={22} />
            Evidence position only. Not a compliance determination.
          </p>
        </main>
      ) : null}
      {stage === 'intake' && prepared ? (
        <Intake
          tables={prepared.tables}
          pack={pack}
          busy={busy}
          onApply={applyMapping}
          onContinue={review}
          onBack={openUpload}
        />
      ) : null}
      {stage === 'review' && position && reviewTables ? (
        <Review
          position={position}
          tables={reviewTables.tables}
          pack={pack}
          demo={demo}
          onAdd={openUpload}
          onDownload={setExportType}
          onIntake={() => {
            setPrepared(reviewTables)
            setPreparedInput(reviewInput)
            setStage('intake')
          }}
        />
      ) : null}
      {exportType && position ? (
        <ExportDialog
          position={position}
          initialType={exportType}
          onClose={() => setExportType(null)}
          onDownload={download}
        />
      ) : null}
      {uploadOpen ? (
        <Upload
          files={draftFiles}
          provider={provider}
          from={from}
          to={to}
          busy={busy}
          error={error}
          onFiles={(f) => {
            setDraftFiles(f)
            if (!f.length) setDemo(false)
          }}
          onProvider={setProvider}
          onFrom={setFrom}
          onTo={setTo}
          onClose={() => setUploadOpen(false)}
          onContinue={() => void inspect(input())}
        />
      ) : null}
    </div>
  )
}

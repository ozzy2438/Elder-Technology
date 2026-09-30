import type { JurisdictionPack } from '../engine/pack.ts'

export function Controls(props: {
  packs: JurisdictionPack[]
  packId: string
  pack: JurisdictionPack
  providerRef: string
  periodFrom: string
  periodTo: string
  files: File[]
  busy: boolean
  onPackChange: (id: string) => void
  onProvider: (value: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onPick: (list: FileList | null) => void
  onRun: () => void
  onDemo: () => void
  onGap: () => void
}) {
  const {
    packs,
    packId,
    pack,
    providerRef,
    periodFrom,
    periodTo,
    files,
    busy,
    onPackChange,
    onProvider,
    onFrom,
    onTo,
    onPick,
    onRun,
    onDemo,
    onGap,
  } = props

  return (
    <section className="controls" aria-label="Run an evidence position" aria-busy={busy}>
      <label className="field">
        <span>Market</span>
        <select value={packId} onChange={(e) => onPackChange(e.target.value)}>
          {packs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="primary-actions">
        <button type="button" className="primary" disabled={busy} onClick={onDemo}>
          {busy ? 'Working…' : 'Load demo'}
        </button>
        <button type="button" className="primary quiet" disabled={busy || files.length === 0} onClick={onRun}>
          {busy ? 'Working…' : 'Run'}
        </button>
      </div>
      <p className="hint">
        Load demo uses sample exports for {pack.label}. Run uses files you choose. Records stay in this
        browser. Names in name columns are stripped from the report.
      </p>

      <details className="more">
        <summary>More options</summary>
        <div className="more-body">
          <label className="field">
            <span>Provider ref</span>
            <input value={providerRef} onChange={(e) => onProvider(e.target.value)} autoComplete="off" />
          </label>
          <div className="dates">
            <label className="field">
              <span>Period from</span>
              <input type="date" value={periodFrom} onChange={(e) => onFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>Period to</span>
              <input type="date" value={periodTo} onChange={(e) => onTo(e.target.value)} />
            </label>
          </div>
          <label className="field drop">
            <span>Your export files (CSV or XLSX)</span>
            <input
              type="file"
              multiple
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => onPick(e.target.files)}
            />
          </label>
          {files.length > 0 ? (
            <ul className="file-list">
              {files.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">No files chosen yet.</p>
          )}
          <button type="button" className="ghost" disabled={busy} onClick={onGap}>
            {pack.demo.drop_label}
          </button>
        </div>
      </details>
    </section>
  )
}

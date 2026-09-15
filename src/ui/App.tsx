import { useMemo, useState } from 'react'
import { DEMO_PERIOD, DEMO_PROVIDER, demoFiles } from '../engine/demo.ts'
import { coverageLabel, positionToHuman, runAnalysis } from '../engine/index.ts'
import type { EvidencePosition, Exposure, Grade } from '../engine/types.ts'

export function App() {
  const [providerRef, setProviderRef] = useState('PROV-UNSET')
  const [periodFrom, setPeriodFrom] = useState('2026-01-01')
  const [periodTo, setPeriodTo] = useState('2026-03-31')
  const [files, setFiles] = useState<File[]>([])
  const [position, setPosition] = useState<EvidencePosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [intakeSeen, setIntakeSeen] = useState(false)

  const human = useMemo(() => (position ? positionToHuman(position) : null), [position])

  async function analyse(
    nextFiles: File[] = files,
    ref = providerRef,
    from = periodFrom,
    to = periodTo,
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

  async function loadDemo() {
    const demo = demoFiles()
    setFiles(demo)
    setProviderRef(DEMO_PROVIDER)
    setPeriodFrom(DEMO_PERIOD.from)
    setPeriodTo(DEMO_PERIOD.to)
    setPosition(null)
    setIntakeSeen(false)
    await analyse(demo, DEMO_PROVIDER, DEMO_PERIOD.from, DEMO_PERIOD.to)
  }

  async function loadDemoMissingBilling() {
    const demo = demoFiles().filter((f) => f.name !== 'billing.csv')
    setFiles(demo)
    setProviderRef(DEMO_PROVIDER)
    setPeriodFrom(DEMO_PERIOD.from)
    setPeriodTo(DEMO_PERIOD.to)
    setPosition(null)
    setIntakeSeen(false)
    await analyse(demo, DEMO_PROVIDER, DEMO_PERIOD.from, DEMO_PERIOD.to)
  }

  function downloadJson() {
    if (!position) return
    const blob = new Blob([JSON.stringify(position, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-position-${position.run.provider_ref}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="desk">
      <header className="mast">
        <p className="kicker">Elder-Technology · Support at Home</p>
        <h1>Evidence position</h1>
        <p className="banner">
          This is an evidence position, not a compliance determination. It does not say whether a
          provider will pass or fail an audit. It reports what the supplied records show, with
          pointers, and what they do not show.
        </p>
      </header>

      <div className="layout">
        <aside className="rail">
          <label>
            Provider ref
            <input value={providerRef} onChange={(e) => setProviderRef(e.target.value)} />
          </label>
          <label>
            Period from
            <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </label>
          <label>
            Period to
            <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </label>
          <label className="drop">
            Export files (CSV or XLSX)
            <input
              type="file"
              multiple
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => onPick(e.target.files)}
            />
          </label>
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
          <div className="actions">
            <button type="button" disabled={busy || files.length === 0} onClick={() => void analyse()}>
              {busy ? 'Running…' : 'Run intake and position'}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void loadDemo()}>
              Load demo pack
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={() => void loadDemoMissingBilling()}
            >
              Demo without billing
            </button>
          </div>
          <p className="hint">
            Records stay in this browser. Names in name columns are stripped from the report.
            Analysis never leaves the device.
          </p>
        </aside>

        <main>
          {error ? <p className="error">{error}</p> : null}

          {!position ? (
            <p className="empty">
              Drop provider exports, then run. Findings stay hidden until intake is on screen.
            </p>
          ) : null}

          {position && intakeSeen ? (
            <>
              <section>
                <h2>Intake</h2>
                <p className="lede">
                  Provider {position.run.provider_ref} · {position.intake.files.length} files ·
                  period {position.run.period.from} to {position.run.period.to} · corpus sqs-sah-v1.
                  A gap in the inputs is a headline finding.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Class</th>
                      <th>Rows</th>
                      <th>Dates</th>
                      <th>Null rates (relied-on fields)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {position.intake.files.map((f) => (
                      <tr key={f.source_file}>
                        <td>{f.source_file}</td>
                        <td>
                          <code>{f.source_class}</code>
                        </td>
                        <td>{f.row_count}</td>
                        <td>
                          {f.date_min ?? '—'} → {f.date_max ?? '—'}
                        </td>
                        <td>
                          {Object.entries(f.null_rates)
                            .map(([k, v]) => `${k} ${v === 0 ? '0' : v.toFixed(2)}`)
                            .join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {position.intake.unassessable_requirements.length > 0 ? (
                  <div className="callout">
                    <h3>Unassessable (source absent)</h3>
                    <ul>
                      {position.intake.unassessable_requirements.map((u) => (
                        <li key={u.claim_id}>
                          <code>{u.claim_id}</code> — {u.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="lede">All in-scope claims have their source classes in this upload.</p>
                )}
              </section>

              <section>
                <div className="row-head">
                  <h2>Highest-exposure findings</h2>
                  <button type="button" className="ghost" onClick={downloadJson}>
                    Download JSON
                  </button>
                </div>
                <ol className="lead">
                  {human?.lead.map((item) => (
                    <li key={item.id}>{item.sentence}</li>
                  ))}
                </ol>
              </section>

              <section>
                <h2>Full table</h2>
                <p className="lede">Ordered by exposure, not by Standard number. Coverage is a fraction, not a score.</p>
                <table className="findings">
                  <thead>
                    <tr>
                      <th>Exposure</th>
                      <th>Grade</th>
                      <th>Claim</th>
                      <th>Coverage</th>
                      <th>Pointer</th>
                      <th>Closes with</th>
                    </tr>
                  </thead>
                  <tbody>
                    {human?.table.map((f) => (
                      <tr key={f.id} className={`exp-${f.exposure.toLowerCase()}`}>
                        <td>
                          <ExposureMark value={f.exposure} />
                        </td>
                        <td>
                          <GradeMark value={f.grade} />
                        </td>
                        <td>
                          <div className="claim">
                            <code>{f.id}</code>
                            <span className="std">{f.standard}</span>
                            <p>{f.testable_claim}</p>
                            <p className="rationale">{f.exposure_rationale}</p>
                            {f.exceptions.length > 0 ? (
                              <ul className="ex">
                                {f.exceptions.slice(0, 8).map((ex) => (
                                  <li key={ex.locator}>
                                    {ex.ref}: {ex.reason} ({ex.locator})
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </td>
                        <td>{coverageLabel(f.coverage.assessed, f.coverage.satisfied)}</td>
                        <td>
                          {f.exceptions[0]?.locator ||
                            (f.evidence[0]
                              ? `${f.evidence[0].source_file} ${f.evidence[0].locator}`
                              : '—')}
                        </td>
                        <td>{f.closes_with}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section>
                <h2>Open questions</h2>
                <ul>
                  {position.open_questions.map((q) => (
                    <li key={q.id}>
                      {q.question}
                      {q.related_claim_id ? (
                        <>
                          {' '}
                          <code>{q.related_claim_id}</code>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}

function ExposureMark({ value }: { value: Exposure }) {
  return <span className={`pill pill-${value.toLowerCase()}`}>{value}</span>
}

function GradeMark({ value }: { value: Grade }) {
  return <span className="grade">{value}</span>
}

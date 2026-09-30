import { coverageLabel } from '../engine/index.ts'
import type { EvidencePosition, Finding } from '../engine/types.ts'
import { ExposureMark, GradeMark } from './marks.tsx'
import { PaperStack } from './PaperStack.tsx'

export function EmptyState() {
  return (
    <section className="empty-card" aria-labelledby="empty-title">
      <PaperStack />
      <div>
        <h2 id="empty-title">Start with the demo</h2>
        <p>
          Choose a market, then Load demo. Intake appears first. Highest-exposure findings come next.
          Nothing is hidden behind a score.
        </p>
      </div>
    </section>
  )
}

export function Results(props: {
  position: EvidencePosition
  lead: Array<{ id: string; sentence: string }>
  table: Finding[]
  onDownload: () => void
}) {
  const { position, lead, table, onDownload } = props
  return (
    <div className="story">
      <nav className="story-nav" aria-label="Results sections">
        <a href="#intake">1 Intake</a>
        <a href="#findings">2 Top findings</a>
        <a href="#table">3 Full table</a>
        <a href="#questions">4 Questions</a>
      </nav>

      <section id="intake" className="panel">
        <p className="step">1</p>
        <h2>Intake</h2>
        <p className="lede">
          Provider {position.run.provider_ref} · {position.intake.files.length} files · period{' '}
          {position.run.period.from} to {position.run.period.to} · pack {position.run.pack_id} · corpus{' '}
          {position.run.corpus_id}. A gap in the inputs is a headline finding.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Class</th>
                <th>Rows</th>
                <th>Dates</th>
                <th>Empty fields</th>
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
                    <EmptyFields rates={f.null_rates} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      <section id="findings" className="panel">
        <div className="row-head">
          <div>
            <p className="step">2</p>
            <h2>Highest-exposure findings</h2>
          </div>
          <button type="button" className="ghost" onClick={onDownload}>
            Download JSON
          </button>
        </div>
        <p className="lede">Read these first. Each line names the claim, the pointer, and the date.</p>
        <ol className="lead-list">
          {lead.map((item) => (
            <li key={item.id} className="lead-card">
              <p>{item.sentence}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="table" className="panel">
        <p className="step">3</p>
        <h2>Full table</h2>
        <p className="lede">Ordered by exposure, not by Standard number. Coverage is a fraction, not a score.</p>
        <div className="table-wrap">
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
              {table.map((f) => (
                <tr key={f.id}>
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
                      <details>
                        <summary>Why this exposure, and exceptions</summary>
                        <p className="rationale">{f.exposure_rationale}</p>
                        {f.exceptions.length > 0 ? (
                          <ul className="ex">
                            {f.exceptions.slice(0, 8).map((ex) => (
                              <li key={ex.locator}>
                                {ex.ref}: {ex.reason} ({ex.locator})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rationale">No row exceptions on this claim.</p>
                        )}
                      </details>
                    </div>
                  </td>
                  <td>{coverageLabel(f.coverage.assessed, f.coverage.satisfied)}</td>
                  <td>
                    {f.exceptions[0]?.locator ||
                      (f.evidence[0] ? `${f.evidence[0].source_file} ${f.evidence[0].locator}` : '—')}
                  </td>
                  <td>{f.closes_with}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="questions" className="panel">
        <p className="step">4</p>
        <h2>Open questions</h2>
        <ul className="questions">
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
    </div>
  )
}

function EmptyFields({ rates }: { rates: Record<string, number> }) {
  const entries = Object.entries(rates)
  if (entries.length === 0) return <span>—</span>
  const empty = entries.filter(([, value]) => value > 0)
  const summary = empty.length === 0 ? 'None empty' : `${empty.length} partly empty`
  return (
    <details>
      <summary>{summary}</summary>
      <p className="rates">
        {entries.map(([key, value]) => `${key} ${value === 0 ? '0' : value.toFixed(2)}`).join(' · ')}
      </p>
    </details>
  )
}

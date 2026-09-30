import { useState } from 'react'
import type { EvidencePosition, EvidencePointer, Finding, ParsedTable } from '../engine/types.ts'
import type { JurisdictionPack } from '../engine/pack.ts'
import { Dialog } from './Dialog.tsx'
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  CircleIcon,
  DownloadSimpleIcon,
  FileTextIcon,
  InfoIcon,
  PlusIcon,
  CaretDownIcon,
} from './icons.ts'
import {
  dateLabel,
  detailDescription,
  detailTitle,
  evidenceFor,
  findingSubtitle,
  findingTitle,
  firstDate,
  gradeLabels,
  humanField,
  isAttention,
  sourceLabels,
} from './presentation.ts'

type Filter = 'attention' | 'found' | 'unassessed'
export function Review({
  position,
  tables,
  pack,
  demo,
  onAdd,
  onDownload,
  onIntake,
}: {
  position: EvidencePosition
  tables: ParsedTable[]
  pack: JurisdictionPack
  demo: boolean
  onAdd: () => void
  onDownload: (type: 'json' | 'txt') => void
  onIntake: () => void
}) {
  const [filter, setFilter] = useState<Filter>('attention')
  const [selectedId, setSelectedId] = useState('')
  const [exceptionIndex, setExceptionIndex] = useState(0)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [source, setSource] = useState<EvidencePointer | null>(null)
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const attention = position.findings.filter(isAttention)
  const found = position.findings.filter((f) => f.grade === 'PRESENT')
  const unassessed = position.findings.filter((f) => f.grade === 'NOT_TESTABLE_FROM_DATA')
  const visible = filter === 'attention' ? attention : filter === 'found' ? found : unassessed
  const selected = visible.find((f) => f.id === selectedId) ?? visible[0]
  const index = selected ? visible.indexOf(selected) : -1
  function choose(f: Finding) {
    setSelectedId(f.id)
    setExceptionIndex(0)
    setMobileDetail(true)
  }
  function move(offset: number) {
    const next = visible[index + offset]
    if (next) choose(next)
  }
  const pointers = selected ? evidenceFor(selected, exceptionIndex) : []
  const row = source
    ? tables.flatMap((t) => t.rows).find((r) => r.locator === source.locator)
    : undefined
  const recordRef = (pointer: EvidencePointer) => {
    const r = tables.flatMap((t) => t.rows).find((r) => r.locator === pointer.locator)
    return (
      r?.values.record_id ||
      r?.values.claim_id ||
      r?.values.worker_id ||
      r?.values.incident_id ||
      r?.values.consent_id ||
      r?.values.policy_id ||
      r?.values.plan_id ||
      pointer.locator
    )
  }
  const recordLabel = (pointer: EvidencePointer) => {
    const table = tables.find((t) => t.source_file === pointer.source_file)
    if (table?.source_class === 'service_delivery') return 'Service record'
    if (table?.source_class === 'competency') return 'Competency record'
    if (table?.source_class === 'billing') return 'Claim record'
    if (table?.source_class === 'care_plans') return 'Care-plan event'
    return table
      ? {
          incidents: 'Incident record',
          participant_register: 'Participant record',
          policies: 'Policy record',
          consent: 'Consent record',
          workers: 'Worker record',
          roster: 'Roster entry',
          unknown: 'Unidentified record',
        }[table.source_class] || `${sourceLabels[table.source_class]} record`
      : pointer.source_file === '(intake)'
        ? 'Intake / scope'
        : 'Corpus reference'
  }
  const currentException = selected?.exceptions[exceptionIndex]
  return (
    <main id="main" className="review-page">
      <div className="review-heading">
        <div>
          <h1>Evidence review</h1>
          <p>
            {attention.length
              ? `${attention.length} ${attention.length === 1 ? 'item needs' : 'items need'} attention`
              : 'No record gaps identified by the assessed checks'}{' '}
            ·{' '}
            <button className="inline-button" onClick={onIntake}>
              {position.run.sources.length} files reviewed
            </button>
          </p>
        </div>
        <div className="review-context">
          <span>
            {demo ? 'Demo data' : position.run.provider_ref}: {dateLabel(position.run.period.from)}{' '}
            – {dateLabel(position.run.period.to)}
          </span>
          <span>Today: {dateLabel(new Date().toISOString().slice(0, 10), true)}</span>
        </div>
      </div>
      <div className="review-toolbar">
        <div className="view-tabs" role="group" aria-label="Evidence views">
          {(
            [
              ['attention', 'Needs attention', attention.length],
              ['found', 'Evidence found', found.length],
              ['unassessed', 'Not assessed', unassessed.length],
            ] as const
          ).map(([v, label, count]) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => {
                setFilter(v)
                setSelectedId('')
                setExceptionIndex(0)
                setMobileDetail(false)
              }}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <div className="review-utilities">
          <button className="text-button" onClick={() => setQuestionsOpen(true)}>
            Open questions<span className="count">{position.open_questions.length}</span>
          </button>
          <details className="export-menu">
            <summary>
              <DownloadSimpleIcon size={18} />
              Export
              <CaretDownIcon size={15} />
            </summary>
            <div>
              <button onClick={() => onDownload('txt')}>Readable report (.txt)</button>
              <button onClick={() => onDownload('json')}>Structured data (.json)</button>
            </div>
          </details>
        </div>
      </div>
      <div className={`review-workspace ${mobileDetail ? 'show-detail' : ''}`}>
        <aside className="finding-list" aria-label="Findings">
          {visible.length ? (
            visible.map((f) => (
              <button
                key={f.id}
                className={`finding-row ${selected?.id === f.id ? 'selected' : ''}`}
                aria-pressed={selected?.id === f.id}
                onClick={() => choose(f)}
              >
                <span className="finding-mark">
                  {f.grade === 'PRESENT' ? (
                    <CheckIcon size={18} />
                  ) : (
                    <CircleIcon
                      size={14}
                      weight={f.grade === 'NOT_TESTABLE_FROM_DATA' ? 'regular' : 'fill'}
                    />
                  )}
                </span>
                <span className="finding-copy">
                  <strong>{findingTitle(f)}</strong>
                  <span>{findingSubtitle(f)}</span>
                </span>
                <span className="finding-date">{firstDate(f) ? dateLabel(firstDate(f)) : '—'}</span>
                <CaretRightIcon size={21} />
              </button>
            ))
          ) : (
            <div className="list-empty">
              <CheckIcon size={26} />
              <h2>
                {filter === 'attention' ? 'Nothing in this queue' : 'No records in this view'}
              </h2>
              <p>
                {filter === 'attention'
                  ? 'Check “Not assessed” for sources or rules that are still missing.'
                  : 'Only the supplied data and loaded rules are assessed.'}
              </p>
              <button className="text-button" onClick={() => setFilter('unassessed')}>
                View assessment gaps
                <CaretRightIcon size={18} />
              </button>
            </div>
          )}
        </aside>
        <section className="finding-detail" aria-label="Selected finding">
          <button className="text-button mobile-back" onClick={() => setMobileDetail(false)}>
            <ArrowLeftIcon size={20} /> All findings
          </button>
          {selected ? (
            <>
              <div className="detail-navigation">
                <p className="eyebrow">
                  {filter === 'unassessed' ? 'Check' : 'Finding'} {index + 1} of {visible.length}
                </p>
                <div>
                  <button
                    className="icon-button bordered"
                    aria-label="Previous finding"
                    disabled={index <= 0}
                    onClick={() => move(-1)}
                  >
                    <CaretLeftIcon size={22} />
                  </button>
                  <button
                    className="icon-button bordered"
                    aria-label="Next finding"
                    disabled={index >= visible.length - 1}
                    onClick={() => move(1)}
                  >
                    <CaretRightIcon size={22} />
                  </button>
                </div>
              </div>
              <h2>{detailTitle(selected)}</h2>
              <p className="detail-description">{detailDescription(selected)}</p>
              {selected.exceptions.length > 1 ? (
                <label className="exception-select">
                  Records needing attention
                  <select
                    aria-label="Choose exception record"
                    value={exceptionIndex}
                    onChange={(e) => setExceptionIndex(Number(e.target.value))}
                  >
                    {selected.exceptions.map((e, i) => (
                      <option key={`${e.locator}:${i}`} value={i}>
                        {i + 1} of {selected.exceptions.length} · {e.ref}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="evidence-records">
                {pointers.map((pointer, i) => (
                  <div className="evidence-row" key={`${pointer.locator}:${i}`}>
                    <FileTextIcon className="record-icon" size={32} weight="light" />
                    <div className="record-copy">
                      <strong>{recordLabel(pointer)}</strong>
                      <span>{recordRef(pointer)}</span>
                    </div>
                    <div className="record-action">
                      <span>
                        {/ON-DATE/.test(selected.id) &&
                        /valid_to=/.test(pointer.extract) &&
                        /expired/i.test(currentException?.reason ?? '')
                          ? 'Expired before visit'
                          : dateLabel(pointer.date)}
                      </span>
                      <button className="record-link" onClick={() => setSource(pointer)}>
                        View record
                        <ArrowUpRightIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <details className="rule-details" key={selected.id}>
                <summary>
                  <CaretDownIcon size={20} />
                  <span>
                    <strong>Rule and scope</strong>
                    <span>Why this matters and which records are checked.</span>
                  </span>
                </summary>
                <div className="rule-body">
                  {currentException ? (
                    <>
                      <h3>Selected record gap</h3>
                      <p>{currentException.reason}</p>
                    </>
                  ) : null}
                  <h3>Evidence needed</h3>
                  <p>{selected.closes_with}</p>
                </div>
                <RuleScope finding={selected} pack={pack} position={position} />
              </details>
              <div className="detail-actions">
                <button className="button primary" onClick={onAdd}>
                  <PlusIcon size={23} />
                  Add evidence
                </button>
                {index < visible.length - 1 ? (
                  <button className="button secondary" onClick={() => move(1)}>
                    Next finding
                    <CaretRightIcon size={22} />
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setFilter(filter === 'unassessed' ? 'attention' : 'unassessed')
                      setSelectedId('')
                      setMobileDetail(false)
                    }}
                  >
                    {filter === 'unassessed' ? 'Back to attention' : 'View assessment gaps'}
                    <CaretRightIcon size={22} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="detail-empty">
              <h2>Review the assessment gaps</h2>
              <p>
                No gaps were identified by the limited checks that ran. Missing sources and
                uncovered rules still need review.
              </p>
              <button className="button secondary" onClick={() => setFilter('unassessed')}>
                View assessment gaps
              </button>
            </div>
          )}
          <p className="scope-footer">
            <InfoIcon size={22} />
            <span>Evidence position only. Not a compliance determination.</span>
          </p>
        </section>
      </div>
      {source ? (
        <Dialog title="Source record" onClose={() => setSource(null)}>
          <p className="source-file">{source.source_file}</p>
          <p className="muted">
            {source.locator} · {dateLabel(source.date)}
          </p>
          {row ? (
            <dl className="record-fields">
              {Object.entries(row.values).map(([k, v]) => (
                <div key={k}>
                  <dt>{humanField(k)}</dt>
                  <dd>{v || 'Not supplied'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="source-extract">
              <p>{source.extract}</p>
              <p className="quiet-note">
                {source.source_file === '(intake)'
                  ? 'This is a scope note, not an uploaded source record.'
                  : 'This pointer is from the bundled corpus, not an uploaded record. Its applicability is shown under Rule and scope.'}
              </p>
            </div>
          )}
          <p className="quiet-note">
            Mapped values only. Names and unmapped free-text fields are excluded.
          </p>
        </Dialog>
      ) : null}
      {questionsOpen ? (
        <Dialog title="Open questions" onClose={() => setQuestionsOpen(false)} wide>
          <p className="dialog-intro">
            Resolve these with source evidence before relying on the review.
          </p>
          <ol className="question-list">
            {position.open_questions.map((q) => (
              <li key={q.id}>
                <p>{q.question}</p>
                {q.related_claim_id ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      const f = position.findings.find((f) => f.id === q.related_claim_id)
                      if (f) {
                        setFilter(
                          f.grade === 'NOT_TESTABLE_FROM_DATA'
                            ? 'unassessed'
                            : f.grade === 'PRESENT'
                              ? 'found'
                              : 'attention',
                        )
                        choose(f)
                        setQuestionsOpen(false)
                      }
                    }}
                  >
                    View related check
                    <CaretRightIcon size={17} />
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </Dialog>
      ) : null}
    </main>
  )
}
function RuleScope({
  finding,
  pack,
  position,
}: {
  finding: Finding
  pack: JurisdictionPack
  position: EvidencePosition
}) {
  const claim = pack.claims.find((c) => c.id === finding.id)!
  return (
    <div className="rule-body">
      <p className="scope-label">
        {claim.corpus_status === 'grounded'
          ? 'Source-grounded check'
          : claim.corpus_status === 'uncovered'
            ? 'Rule not established in loaded corpus'
            : 'Operational record check · regulatory context only'}
      </p>
      <p>{finding.testable_claim}</p>
      <p>{claim.corpus_note}</p>
      <dl>
        <div>
          <dt>Coverage</dt>
          <dd>
            {finding.coverage.assessed
              ? `${finding.coverage.satisfied} of ${finding.coverage.assessed} supported`
              : 'No assessable records / rule'}
          </dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>
            {dateLabel(position.run.period.from)} – {dateLabel(position.run.period.to)}
          </dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>
            {claim.evidence_requirement.artefact_types.map((c) => sourceLabels[c]).join(', ')}
          </dd>
        </div>
        <div>
          <dt>Basis</dt>
          <dd>{claim.evidence_requirement.coverage_basis}</dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd>{claim.evidence_requirement.freshness_window}</dd>
        </div>
        <div>
          <dt>Record grade</dt>
          <dd>
            {gradeLabels[finding.grade]} ({finding.grade})
          </dd>
        </div>
      </dl>
      <p>{finding.exposure_rationale}</p>
      <h3>Regulatory source context</h3>
      {claim.corpus_pointers.map((pointer, i) => {
        const source = pack.corpus.sources.find((s) => s.id === pointer.source_id)
        return (
          <div className="corpus-source" key={i}>
            <strong>{source?.title || pointer.source_id}</strong>
            <p>“{pointer.quote}”</p>
            <small>{pointer.locator}</small>
            {source ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                Open source
                <ArrowUpRightIcon size={16} />
              </a>
            ) : null}
          </div>
        )
      })}
      <p className="quiet-note">
        Corpus {pack.corpus.corpus_id} · retrieved {dateLabel(pack.corpus.retrieved_at)}. General
        source context does not establish the exact field-level test or its legal applicability.
      </p>
    </div>
  )
}

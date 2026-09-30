import type {
  EvidencePosition,
  Finding,
  EvidencePointer,
  Grade,
  SourceClass,
} from '../engine/types.ts'

export function humanField(value: string) {
  return value.replace(/_/g, ' ').replace(/^raw /, '')
}
export function dateLabel(value?: string | null, long = false): string {
  if (!value) return 'Date not supplied'
  const day = value.slice(0, 10)
  const date = new Date(`${day}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  const label = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return value.length > 10 ? `${label} · ${value.slice(11).replace('T', ' ')}` : label
}
export const gradeLabels: Record<Grade, string> = {
  PRESENT: 'Evidence found',
  PARTIAL: 'Partial evidence',
  MISSING: 'Evidence missing',
  STALE: 'Out of date',
  CONTRADICTED: 'Sources disagree',
  NOT_TESTABLE_FROM_DATA: 'Not assessed',
}
export function isAttention(f: Finding) {
  return f.grade !== 'PRESENT' && f.grade !== 'NOT_TESTABLE_FROM_DATA'
}

export function findingTitle(f: Finding): string {
  const id = f.id
  if (/UNMATCHED-CLAIMS|UNMATCHED-INVOICES/.test(id))
    return f.grade === 'PRESENT' ? 'Claims linked to delivery' : 'Unmatched claim'
  if (/UNMATCHED-DELIVERIES|UNMATCHED-VISITS/.test(id))
    return f.grade === 'PRESENT' ? 'Deliveries linked to claims' : 'Delivery without a claim'
  if (/DURATION/.test(id))
    return f.grade === 'PRESENT'
      ? 'Claim and delivery durations match'
      : 'Claim and delivery duration mismatch'
  if (/ON-DATE/.test(id))
    return f.grade === 'PRESENT'
      ? 'Competency covers delivery dates'
      : f.exceptions.some((e) => /expired/i.test(e.reason))
        ? 'Competency record expired'
        : 'Competency evidence missing'
  if (/EXPIRED-NOW/.test(id))
    return f.grade === 'PRESENT'
      ? 'Competency current at period end'
      : 'Competency expired by period end'
  if (/CONSENT/.test(id))
    return f.grade === 'PRESENT' ? 'Consent linked to plan events' : 'Consent not linked'
  if (/LIFECYCLE/.test(id))
    return f.grade === 'PRESENT'
      ? 'Incident lifecycle recorded'
      : f.exceptions.some((e) => /closed_at blank/.test(e.reason))
        ? 'Incident closure missing'
        : 'Incident lifecycle incomplete'
  if (/TRIGGER|AFTER-SAFEGUARDING/.test(id))
    return f.grade === 'PRESENT'
      ? 'Review recorded after incident'
      : 'Review after incident missing'
  if (/INTERVAL/.test(id)) return 'Review interval not established'
  if (/POLICY-CURRENCY/.test(id))
    return f.grade === 'PRESENT' ? 'Policy register current' : 'Policy currency needs attention'
  if (/ENACTMENT/.test(id))
    return f.grade === 'PRESENT'
      ? 'Policy linked to practice records'
      : 'Policy practice evidence missing'
  if (/INTERNAL/.test(id))
    return f.grade === 'PRESENT'
      ? 'Classification records agree'
      : f.grade === 'CONTRADICTED'
        ? 'Classification records disagree'
        : 'Classification evidence missing'
  if (/OFFICIAL-MAP/.test(id)) return 'Official mapping not available'
  if (/EXPERIENCE/.test(id)) return 'Experience evidence not supplied'
  if (/OBSERVATION/.test(id)) return 'Observation cannot be assessed'
  return f.outcome
}
export function findingSubtitle(f: Finding): string {
  if (f.grade === 'NOT_TESTABLE_FROM_DATA')
    return f.coverage.assessed ? gradeLabels[f.grade] : 'Source or rule needed to assess this check'
  if (f.grade === 'PRESENT')
    return `${f.coverage.satisfied} of ${f.coverage.assessed} records meet this limited check`
  const count = f.exceptions.length
  if (/ON-DATE/.test(f.id) && f.exceptions[0])
    return humanField(f.exceptions[0].ref.split('/').slice(1).join(' · '))
  return `${count} ${count === 1 ? 'record needs' : 'records need'} attention · ${f.coverage.satisfied} of ${f.coverage.assessed} supported`
}
export function firstDate(f: Finding) {
  const locators = f.exceptions[0]?.locator.split('|') ?? []
  return (
    f.evidence.find((p) => locators.includes(p.locator))?.date ||
    (f.exceptions.length ? '' : f.evidence[0]?.date)
  )
}
export function detailTitle(f: Finding): string {
  if (f.grade === 'NOT_TESTABLE_FROM_DATA') return 'This check needs more information'
  if (f.grade === 'PRESENT') return findingTitle(f)
  if (/ON-DATE/.test(f.id)) return 'Missing competency evidence for this visit'
  if (/UNMATCHED-CLAIMS|UNMATCHED-INVOICES/.test(f.id))
    return 'A claim has no unique delivery match'
  if (/DURATION/.test(f.id)) return 'The two records do not show the same duration'
  if (/CONSENT/.test(f.id)) return 'Consent is missing for a specific plan event'
  return findingTitle(f)
}
export function detailDescription(f: Finding): string {
  if (/ON-DATE/.test(f.id) && isAttention(f))
    return 'The service record indicates a worker provided care, but no valid competency record covers the worker, service type and delivery date.'
  if (/UNMATCHED-CLAIMS|UNMATCHED-INVOICES/.test(f.id) && isAttention(f))
    return 'The claim cannot be linked to a single delivery record using participant, date, worker and service type. Check the source records before deciding what happened.'
  if (/CONSENT/.test(f.id) && isAttention(f))
    return 'This plan event has no uniquely linked, dated consent record. An earlier generic consent does not establish consent for a later change.'
  if (f.grade === 'NOT_TESTABLE_FROM_DATA') return f.exposure_rationale
  return f.exposure_rationale
}
export function evidenceFor(f: Finding, exceptionIndex: number): EvidencePointer[] {
  const exception = f.exceptions[exceptionIndex]
  if (!exception || f.grade === 'NOT_TESTABLE_FROM_DATA') return f.evidence
  const locators = exception.locator.split('|')
  const pointers = f.evidence.filter((p) => locators.includes(p.locator))
  if (/ON-DATE/.test(f.id)) {
    const index = f.evidence.findIndex((p) => p.locator === locators[0])
    const next = f.evidence[index + 1]
    if (index >= 0 && next && /valid_to=/.test(next.extract)) pointers.push(next)
  }
  return pointers.length ? [...new Map(pointers.map((p) => [p.locator, p])).values()] : f.evidence
}
export function reportText(position: EvidencePosition): string {
  return [
    `Evidence review — ${position.run.provider_ref}`,
    `${dateLabel(position.run.period.from)} – ${dateLabel(position.run.period.to)}`,
    'Evidence position only. Not a compliance determination.',
    `Pack: ${position.run.pack_id}; corpus: ${position.run.corpus_id}`,
    '',
    'INTAKE',
    ...position.intake.files.map(
      (f) =>
        `${f.source_file}: ${humanField(f.source_class)}, ${f.row_count} rows; missing fields: ${f.unmapped_required.join(', ') || 'none'}; issues: ${f.issues.join('; ') || 'none'}`,
    ),
    '',
    'FINDINGS',
    ...position.findings.flatMap((f) => [
      findingTitle(f),
      `${gradeLabels[f.grade]} · ${f.coverage.satisfied} of ${f.coverage.assessed} supported`,
      f.testable_claim,
      f.exposure_rationale,
      ...f.exceptions.map((e) => `${e.ref}: ${e.reason} [${e.locator}]`),
      ...f.evidence.map(
        (p) => `${p.source_file} / ${p.locator} / ${p.date || 'date not supplied'}: ${p.extract}`,
      ),
      `Evidence needed: ${f.closes_with}`,
      '',
    ]),
    'OPEN QUESTIONS',
    ...position.open_questions.map((q) => q.question),
  ].join('\n')
}

export const sourceLabels: Record<SourceClass, string> = {
  service_delivery: 'Service delivery',
  billing: 'Claims / billing',
  participant_register: 'Participants',
  care_plans: 'Care plans',
  consent: 'Consent',
  incidents: 'Incidents',
  workers: 'Workers',
  competency: 'Competency / training',
  roster: 'Roster',
  policies: 'Policies',
  unknown: 'Confirm source type',
}

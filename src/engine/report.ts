import type { EvidencePosition, Finding, OpenQuestion } from './types.ts'

const EXPOSURE_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const CLAIM_WEIGHT: Record<string, number> = {
  'CC-BILL-UNMATCHED-CLAIMS': 100,
  'CC-COMP-ON-DATE': 95,
  'CC-INCIDENT-LIFECYCLE': 90,
  'CC-CONSENT-LINK': 85,
  'CC-BILL-DURATION': 80,
  'CC-CADENCE-TRIGGER': 75,
  'CC-CLASS-INTERNAL': 70,
  'CC-BILL-UNMATCHED-DELIVERIES': 50,
  'CC-COMP-EXPIRED-NOW': 45,
  'CC-POLICY-ENACTMENT': 40,
  'CC-POLICY-CURRENCY': 35,
  'CC-CADENCE-INTERVAL': 20,
  'CC-CLASS-OFFICIAL-MAP': 15,
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const exp = EXPOSURE_ORDER[a.exposure] - EXPOSURE_ORDER[b.exposure]
    if (exp !== 0) return exp
    const wa = CLAIM_WEIGHT[a.id] ?? 0
    const wb = CLAIM_WEIGHT[b.id] ?? 0
    if (wb !== wa) return wb - wa
    return a.id.localeCompare(b.id)
  })
}

export function leadSentences(findings: Finding[]): Array<{ id: string; sentence: string }> {
  return sortFindings(findings)
    .filter((f) => f.grade !== 'PRESENT')
    .slice(0, 5)
    .map((f) => {
      const pointer =
        f.exceptions[0]?.locator || f.evidence[0]?.locator || f.evidence[0]?.source_file || 'no locator'
      const date = f.evidence[0]?.date
      const dateBit = date ? `, date ${date}` : ''
      return {
        id: f.id,
        sentence: `${f.id}: ${headline(f)} Pointer: ${pointer}${dateBit}.`,
      }
    })
}

function headline(finding: Finding): string {
  const n = finding.exceptions.length
  const of = finding.coverage.assessed
  switch (finding.id) {
    case 'CC-BILL-UNMATCHED-CLAIMS':
      return `Claims extract has ${n} of ${of} rows with no matching delivery record.`
    case 'CC-BILL-UNMATCHED-DELIVERIES':
      return `Service delivery extract has ${n} of ${of} rows with no matching claim.`
    case 'CC-BILL-DURATION':
      return `Matched claim/delivery pairs disagree on duration for ${n} of ${of} pairs.`
    case 'CC-CONSENT-LINK':
      return `Care-plan create or material-change events have no linked dated consent row for ${n} of ${of} events.`
    case 'CC-COMP-ON-DATE':
      return `Deliveries have no competency evidence current on the delivery date for ${n} of ${of} rows.`
    case 'CC-COMP-EXPIRED-NOW':
      return `Competency valid on delivery is not current at period end for ${n} of ${of} worker/service pairs.`
    case 'CC-CADENCE-INTERVAL':
      return 'Loaded corpus does not state a care-plan review interval, so no interval test was applied.'
    case 'CC-CADENCE-TRIGGER':
      return `Incidents have no later care-plan review for ${n} of ${of} incident rows.`
    case 'CC-INCIDENT-LIFECYCLE':
      return `Incident register rows lack a closed timestamp sequence for ${n} of ${of} incidents.`
    case 'CC-POLICY-CURRENCY':
      return `Policy register rows are past review_due or missing approval fields for ${n} of ${of} policies.`
    case 'CC-POLICY-ENACTMENT':
      return `Current policies have no matching practice records for ${n} of ${of} current policies.`
    case 'CC-CLASS-INTERNAL':
      return `Participant register and care plan classifications disagree for ${n} of ${of} participants present in both sources.`
    case 'CC-CLASS-OFFICIAL-MAP':
      return 'Loaded corpus does not include a classification-to-service table, so official mapping was not applied.'
    default:
      return `${finding.grade}: ${finding.testable_claim}`
  }
}

export function uniqueQuestions(questions: OpenQuestion[]): OpenQuestion[] {
  const seen = new Set<string>()
  const out: OpenQuestion[] = []
  for (const q of questions) {
    if (seen.has(q.id) || !q.question) continue
    seen.add(q.id)
    out.push(q)
  }
  return out
}

export function coverageLabel(assessed: number, satisfied: number): string {
  return `${satisfied} of ${assessed}`
}

export function positionToHuman(position: EvidencePosition): {
  lead: Array<{ id: string; sentence: string }>
  table: Finding[]
} {
  return {
    lead: leadSentences(position.findings),
    table: sortFindings(position.findings),
  }
}

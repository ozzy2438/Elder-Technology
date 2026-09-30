import type { Finding } from '../../engine/types.ts'

function rowsOrGap(finding: Finding, whenPresent: string, whenAbsent: string): string {
  if (finding.grade === 'NOT_TESTABLE_FROM_DATA') return whenAbsent
  return whenPresent
}

export function engCqcHeadline(finding: Finding): string {
  const n = finding.exceptions.length
  const of = finding.coverage.assessed
  switch (finding.id) {
    case 'CC-CQC-VISIT-UNMATCHED-INVOICES':
      return rowsOrGap(
        finding,
        `Invoice extract has ${n} of ${of} rows with no matching visit record.`,
        'Invoice extract was not supplied, so unmatched invoices were not graded from rows.',
      )
    case 'CC-CQC-VISIT-UNMATCHED-VISITS':
      return rowsOrGap(
        finding,
        `Visit extract has ${n} of ${of} rows with no matching invoice.`,
        'Visit or invoice extract was not supplied, so unmatched visits were not graded from rows.',
      )
    case 'CC-CQC-VISIT-DURATION':
      return rowsOrGap(
        finding,
        `Matched invoice/visit pairs disagree on duration for ${n} of ${of} pairs.`,
        'Invoice or visit extract was not supplied, so duration matching was not graded from rows.',
      )
    case 'CC-CQC-CONSENT-LINK':
      return rowsOrGap(
        finding,
        `Care-plan create or material-change events have no linked dated consent row for ${n} of ${of} events.`,
        'Care-plan or consent extract was not supplied, so consent linking was not graded from rows.',
      )
    case 'CC-CQC-STAFF-ON-DATE':
      return rowsOrGap(
        finding,
        `Visits have no competency evidence current on the visit date for ${n} of ${of} rows.`,
        'Visit or training extract was not supplied, so competency-on-date was not graded from rows.',
      )
    case 'CC-CQC-STAFF-EXPIRED-NOW':
      return rowsOrGap(
        finding,
        `Competency valid on visit is not current at period end for ${n} of ${of} worker/visit-type pairs.`,
        'Visit or training extract was not supplied, so period-end competency was not graded from rows.',
      )
    case 'CC-CQC-PLAN-INTERVAL':
      return 'Loaded corpus does not state a care-plan review interval, so no interval test was applied.'
    case 'CC-CQC-PLAN-AFTER-SAFEGUARDING':
      return rowsOrGap(
        finding,
        `Safeguarding rows have no later care-plan review for ${n} of ${of} concern rows.`,
        'Safeguarding or care-plan extract was not supplied, so post-concern review was not graded from rows.',
      )
    case 'CC-CQC-SAFEGUARDING-LIFECYCLE':
      return rowsOrGap(
        finding,
        `Safeguarding register rows lack a closed timestamp sequence for ${n} of ${of} concerns.`,
        'Safeguarding register was not supplied, so lifecycle timestamps were not graded from rows.',
      )
    case 'CC-CQC-POLICY-CURRENCY':
      return rowsOrGap(
        finding,
        `Policy register rows are past review_due or missing approval fields for ${n} of ${of} policies.`,
        'Policy register was not supplied, so currency was not graded from rows.',
      )
    case 'CC-CQC-POLICY-ENACTMENT':
      return rowsOrGap(
        finding,
        `Current policies have no matching practice records for ${n} of ${of} current policies.`,
        'Policy register was not supplied, so enactment was not graded from rows.',
      )
    case 'CC-CQC-NEEDS-INTERNAL':
      return rowsOrGap(
        finding,
        `Service-user register and care plan needs fields disagree for ${n} of ${of} people present in both sources.`,
        'Service-user register or care-plan extract was not supplied, so needs coherence was not graded from rows.',
      )
    case 'CC-CQC-NEEDS-OFFICIAL-MAP':
      return 'Loaded corpus does not include a needs-to-service table, so official mapping was not applied.'
    case 'CC-CQC-EXPERIENCE':
      return "People's experience is a CQC evidence category that these operational extracts cannot supply."
    case 'CC-CQC-OBSERVATION':
      return 'On-site observation is a CQC evidence category that spreadsheet exports cannot supply.'
    default:
      return `${finding.grade}: ${finding.testable_claim}`
  }
}

export const ENG_CQC_WEIGHTS: Record<string, number> = {
  'CC-CQC-VISIT-UNMATCHED-INVOICES': 100,
  'CC-CQC-STAFF-ON-DATE': 95,
  'CC-CQC-SAFEGUARDING-LIFECYCLE': 90,
  'CC-CQC-CONSENT-LINK': 85,
  'CC-CQC-VISIT-DURATION': 80,
  'CC-CQC-PLAN-AFTER-SAFEGUARDING': 75,
  'CC-CQC-NEEDS-INTERNAL': 70,
  'CC-CQC-VISIT-UNMATCHED-VISITS': 50,
  'CC-CQC-STAFF-EXPIRED-NOW': 45,
  'CC-CQC-POLICY-ENACTMENT': 40,
  'CC-CQC-POLICY-CURRENCY': 35,
  'CC-CQC-PLAN-INTERVAL': 20,
  'CC-CQC-NEEDS-OFFICIAL-MAP': 15,
  'CC-CQC-EXPERIENCE': 5,
  'CC-CQC-OBSERVATION': 4,
}

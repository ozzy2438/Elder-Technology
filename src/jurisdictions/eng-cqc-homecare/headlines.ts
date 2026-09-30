import type { Finding } from '../../engine/types.ts'

export function engCqcHeadline(finding: Finding): string {
  const n = finding.exceptions.length
  const of = finding.coverage.assessed
  switch (finding.id) {
    case 'CC-CQC-VISIT-UNMATCHED-INVOICES':
      return `Invoice extract has ${n} of ${of} rows with no matching visit record.`
    case 'CC-CQC-VISIT-UNMATCHED-VISITS':
      return `Visit extract has ${n} of ${of} rows with no matching invoice.`
    case 'CC-CQC-VISIT-DURATION':
      return `Matched invoice/visit pairs disagree on duration for ${n} of ${of} pairs.`
    case 'CC-CQC-CONSENT-LINK':
      return `Care-plan create or material-change events have no linked dated consent row for ${n} of ${of} events.`
    case 'CC-CQC-STAFF-ON-DATE':
      return `Visits have no competency evidence current on the visit date for ${n} of ${of} rows.`
    case 'CC-CQC-STAFF-EXPIRED-NOW':
      return `Competency valid on visit is not current at period end for ${n} of ${of} worker/visit-type pairs.`
    case 'CC-CQC-PLAN-INTERVAL':
      return 'Loaded corpus does not state a care-plan review interval, so no interval test was applied.'
    case 'CC-CQC-PLAN-AFTER-SAFEGUARDING':
      return `Safeguarding rows have no later care-plan review for ${n} of ${of} concern rows.`
    case 'CC-CQC-SAFEGUARDING-LIFECYCLE':
      return `Safeguarding register rows lack a closed timestamp sequence for ${n} of ${of} concerns.`
    case 'CC-CQC-POLICY-CURRENCY':
      return `Policy register rows are past review_due or missing approval fields for ${n} of ${of} policies.`
    case 'CC-CQC-POLICY-ENACTMENT':
      return `Current policies have no matching practice records for ${n} of ${of} current policies.`
    case 'CC-CQC-NEEDS-INTERNAL':
      return `Service-user register and care plan needs fields disagree for ${n} of ${of} people present in both sources.`
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

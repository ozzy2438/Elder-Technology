import type { Finding } from '../../engine/types.ts'

function rowsOrGap(finding: Finding, whenPresent: string, whenAbsent: string): string {
  if (finding.grade === 'NOT_TESTABLE_FROM_DATA') return whenAbsent
  return whenPresent
}

export function auSahHeadline(finding: Finding): string {
  const n = finding.exceptions.length
  const of = finding.coverage.assessed
  switch (finding.id) {
    case 'CC-BILL-UNMATCHED-CLAIMS':
      return rowsOrGap(
        finding,
        `Claims extract has ${n} of ${of} rows with no matching delivery record.`,
        'Claims extract was not supplied, so unmatched claims were not graded from rows.',
      )
    case 'CC-BILL-UNMATCHED-DELIVERIES':
      return rowsOrGap(
        finding,
        `Service delivery extract has ${n} of ${of} rows with no matching claim.`,
        'Delivery or claims extract was not supplied, so unmatched deliveries were not graded from rows.',
      )
    case 'CC-BILL-DURATION':
      return rowsOrGap(
        finding,
        `Matched claim/delivery pairs disagree on duration for ${n} of ${of} pairs.`,
        'Claims or delivery extract was not supplied, so duration matching was not graded from rows.',
      )
    case 'CC-CONSENT-LINK':
      return rowsOrGap(
        finding,
        `Care-plan create or material-change events have no linked dated consent row for ${n} of ${of} events.`,
        'Care-plan or consent extract was not supplied, so consent linking was not graded from rows.',
      )
    case 'CC-COMP-ON-DATE':
      return rowsOrGap(
        finding,
        `Deliveries have no competency evidence current on the delivery date for ${n} of ${of} rows.`,
        'Delivery or competency extract was not supplied, so competency-on-date was not graded from rows.',
      )
    case 'CC-COMP-EXPIRED-NOW':
      return rowsOrGap(
        finding,
        `Competency valid on delivery is not current at period end for ${n} of ${of} worker/service pairs.`,
        'Delivery or competency extract was not supplied, so period-end competency was not graded from rows.',
      )
    case 'CC-CADENCE-INTERVAL':
      return 'Loaded corpus does not state a care-plan review interval, so no interval test was applied.'
    case 'CC-CADENCE-TRIGGER':
      return rowsOrGap(
        finding,
        `Incidents have no later care-plan review for ${n} of ${of} incident rows.`,
        'Incident or care-plan extract was not supplied, so post-incident review was not graded from rows.',
      )
    case 'CC-INCIDENT-LIFECYCLE':
      return rowsOrGap(
        finding,
        `Incident register rows lack a closed timestamp sequence for ${n} of ${of} incidents.`,
        'Incident register was not supplied, so lifecycle timestamps were not graded from rows.',
      )
    case 'CC-POLICY-CURRENCY':
      return rowsOrGap(
        finding,
        `Policy register rows are past review_due or missing approval fields for ${n} of ${of} policies.`,
        'Policy register was not supplied, so currency was not graded from rows.',
      )
    case 'CC-POLICY-ENACTMENT':
      return rowsOrGap(
        finding,
        `Current policies have no matching practice records for ${n} of ${of} current policies.`,
        'Policy register was not supplied, so enactment was not graded from rows.',
      )
    case 'CC-CLASS-INTERNAL':
      return rowsOrGap(
        finding,
        `Participant register and care plan classifications disagree for ${n} of ${of} participants present in both sources.`,
        'Participant register or care-plan extract was not supplied, so classification coherence was not graded from rows.',
      )
    case 'CC-CLASS-OFFICIAL-MAP':
      return 'Loaded corpus does not include a classification-to-service table, so official mapping was not applied.'
    default:
      return `${finding.grade}: ${finding.testable_claim}`
  }
}

export const AU_SAH_WEIGHTS: Record<string, number> = {
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

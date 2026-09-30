import type { Finding } from '../../engine/types.ts'

export function auSahHeadline(finding: Finding): string {
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

import { claimById } from '../corpus.ts'
import { uncoveredFinding, gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import type { EngineContext, Finding } from '../types.ts'

export function cadenceFindings(ctx: EngineContext): Finding[] {
  const interval = uncoveredFinding(
    'CC-CADENCE-INTERVAL',
    'A corpus extract stating the required care-plan review interval (days or months)',
  )

  if (!hasClass(ctx, 'incidents')) {
    return [interval, missingSourcesFinding('CC-CADENCE-TRIGGER', ['incidents'])]
  }
  if (!hasClass(ctx, 'care_plans')) {
    return [interval, missingSourcesFinding('CC-CADENCE-TRIGGER', ['care_plans'])]
  }

  const claim = claimById('CC-CADENCE-TRIGGER')
  const incidents = rowsOf(ctx, 'incidents')
  const plans = rowsOf(ctx, 'care_plans')
  const exceptions = []
  const evidence = []
  let satisfied = 0
  for (const incident of incidents) {
    const recorded = incident.values.recorded_at
    const participant = incident.values.participant_id
    const review = plans.find((p) => {
      if (p.values.participant_id !== participant) return false
      const when = p.values.review_date || p.values.event_date
      if (!when || !recorded) return false
      const isReview = /review/i.test(p.values.event_type || '') || Boolean(p.values.review_date)
      return isReview && when >= recorded
    })
    evidence.push(pointerFromRow(incident, 'recorded_at'))
    if (review) {
      satisfied += 1
      evidence.push(pointerFromRow(review, 'review_date' in review.values ? 'review_date' : 'event_date'))
    } else {
      exceptions.push({
        ref: incident.values.incident_id || incident.locator,
        reason: `No care-plan review dated on or after incident recorded_at ${recorded || 'blank'} for ${participant}`,
        locator: incident.locator,
      })
    }
  }

  return [
    interval,
    makeFinding(claim, {
      grade: gradeCoverage(incidents.length, satisfied, incidents.length > 0 && satisfied === 0),
      assessed: incidents.length,
      satisfied,
      evidence: evidence.slice(0, 30),
      exceptions,
      exposure_rationale:
        exceptions.length === 0
          ? 'Each incident row has a later care-plan review for the same participant.'
          : `Incident without a subsequent care-plan review in the supplied files. Loaded corpus does not quote trigger-event rules. ${exceptions.length} of ${incidents.length} incidents have no later review row.`,
      closes_with: exceptions.length
        ? `Care-plan review for the participant on ${exceptions[0].ref}, dated on or after the incident recorded date (${exceptions[0].locator})`
        : 'No further artefact; incidents already have later review rows',
    }),
  ]
}

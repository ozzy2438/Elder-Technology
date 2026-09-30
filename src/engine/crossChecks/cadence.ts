import {
  uncoveredFinding,
  gradeCoverage,
  makeFinding,
  missingSourcesFinding,
  pointerFromRow,
} from '../finding.ts'
import { hasClass, periodRows } from '../intake.ts'
import { compareTemporal, parseTemporal } from '../dates.ts'
import type { EngineContext, Finding } from '../types.ts'
export interface CadenceIds {
  interval: string
  trigger: string
  intervalArtefact: string
}
export function cadenceFindings(ctx: EngineContext, ids: CadenceIds): Finding[] {
  const interval = uncoveredFinding(ctx, ids.interval, ids.intervalArtefact)
  const missing = (['incidents', 'care_plans'] as const).filter((c) => !hasClass(ctx, c))
  if (missing.length) return [interval, missingSourcesFinding(ctx, ids.trigger, missing)]
  const incidents = periodRows(ctx, 'incidents', 'recorded_at')
  const reviews = periodRows(ctx, 'care_plans', 'event_date').filter((p) =>
    /review/i.test(p.values.event_type ?? ''),
  )
  const exceptions = []
  const evidence = []
  let satisfied = 0
  for (const incident of incidents) {
    const review = reviews.find((p) => {
      const when = p.values.review_date || p.values.event_date
      if (
        !incident.values.participant_id ||
        p.values.participant_id !== incident.values.participant_id ||
        !parseTemporal(when)
      )
        return false
      const order = compareTemporal(when, incident.values.recorded_at)
      return order != null && order >= 0 && when.slice(0, 10) <= ctx.period.to
    })
    evidence.push(pointerFromRow(incident, 'recorded_at'))
    if (review) {
      satisfied += 1
      evidence.push(
        pointerFromRow(review, review.values.review_date ? 'review_date' : 'event_date'),
      )
    } else
      exceptions.push({
        ref: incident.values.incident_id || incident.locator,
        reason: `No explicit care-plan review after incident ${incident.values.recorded_at || 'unknown date'} and on/before period end for ${incident.values.participant_id || 'unknown participant'}`,
        locator: incident.locator,
      })
  }
  return [
    interval,
    makeFinding(ctx.claimById(ids.trigger), {
      grade: gradeCoverage(incidents.length, satisfied, incidents.length > 0 && satisfied === 0),
      assessed: incidents.length,
      satisfied,
      evidence,
      exceptions,
      exposure_rationale: `${satisfied} of ${incidents.length} in-period incidents have a subsequent explicit review event within the selected period. Plan creation is not a review. Hospitalisation/classification-change triggers and a required time window are not supplied by this check.`,
      closes_with: exceptions.length
        ? 'Explicit dated care-plan review events linked to the participant after each exception incident'
        : incidents.length
          ? 'No further artefact for this limited incident/review linkage check'
          : 'Incident and review activity in the selected period',
    }),
  ]
}

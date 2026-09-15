import { claimById } from '../corpus.ts'
import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import { truthy } from '../dates.ts'
import type { EngineContext, Finding } from '../types.ts'

function notifyNeeded(values: Record<string, string>): boolean {
  if (truthy(values.notify_required ?? '')) return true
  return /high|reportable|priority|sirs/i.test(values.severity || '')
}

export function incidentFindings(ctx: EngineContext): Finding[] {
  if (!hasClass(ctx, 'incidents')) {
    return [missingSourcesFinding('CC-INCIDENT-LIFECYCLE', ['incidents'])]
  }
  const claim = claimById('CC-INCIDENT-LIFECYCLE')
  const incidents = rowsOf(ctx, 'incidents')
  const exceptions = []
  const evidence = []
  let satisfied = 0
  for (const incident of incidents) {
    const recorded = incident.values.recorded_at
    const actioned = incident.values.actioned_at
    const closed = incident.values.closed_at
    const notified = incident.values.notified_at
    const needsNotify = notifyNeeded(incident.values)
    const reasons: string[] = []
    if (!recorded) reasons.push('recorded_at blank')
    if (!actioned) reasons.push('actioned_at blank')
    if (!closed) reasons.push('closed_at blank')
    if (recorded && actioned && actioned < recorded) reasons.push('actioned_at before recorded_at')
    if (actioned && closed && closed < actioned) reasons.push('closed_at before actioned_at')
    if (needsNotify && !notified) reasons.push('notify_required without notified_at')
    if (needsNotify && notified && recorded && notified < recorded) {
      reasons.push('notified_at before recorded_at')
    }
    evidence.push(pointerFromRow(incident, 'recorded_at'))
    if (reasons.length === 0) {
      satisfied += 1
    } else {
      exceptions.push({
        ref: incident.values.incident_id || incident.locator,
        reason: reasons.join('; '),
        locator: incident.locator,
      })
    }
  }
  return [
    makeFinding(claim, {
      grade: gradeCoverage(incidents.length, satisfied, incidents.length > 0 && satisfied === 0),
      assessed: incidents.length,
      satisfied,
      evidence: evidence.slice(0, 30),
      exceptions,
      exposure_rationale:
        exceptions.length === 0
          ? 'Each incident row has recorded, actioned, and closed timestamps in sequence, and notified_at where notify_required is set.'
          : `Incident lifecycle incomplete in the register. Loaded corpus does not quote notification timestamp rules; sequence is a product evidence requirement. ${exceptions.length} of ${incidents.length} incidents lack a closed sequence.`,
      closes_with: exceptions.length
        ? `Closed lifecycle timestamps for ${exceptions[0].ref} (${exceptions[0].reason}) at ${exceptions[0].locator}`
        : 'No further artefact; incident timestamps already form a closed sequence',
    }),
  ]
}

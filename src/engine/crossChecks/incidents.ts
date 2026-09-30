import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, periodRows } from '../intake.ts'
import { compareTemporal, parseTemporal, truthy } from '../dates.ts'
import type { EngineContext, Finding } from '../types.ts'

export interface IncidentIds {
  lifecycle: string
}
export function lifecycleGaps(values: Record<string, string>): string[] {
  const reasons: string[] = []
  if (!values.incident_id) reasons.push('incident_id blank')
  if (!values.participant_id) reasons.push('participant_id blank')
  for (const f of ['recorded_at', 'actioned_at', 'closed_at']) {
    if (!values[f]) reasons.push(`${f} blank`)
    else if (!parseTemporal(values[f])) reasons.push(`${f} invalid`)
  }
  for (const [later, earlier] of [
    ['actioned_at', 'recorded_at'],
    ['closed_at', 'actioned_at'],
  ]) {
    if (!parseTemporal(values[later]) || !parseTemporal(values[earlier])) continue
    const order = compareTemporal(values[later], values[earlier])
    if (order == null)
      reasons.push(
        `${later}/${earlier} sequence cannot be verified: mixed precision or unspecified time zone`,
      )
    else if (order < 0) reasons.push(`${later} before ${earlier}`)
  }
  if (!/^(true|yes|y|1|false|no|n|0)$/i.test(values.notify_required ?? ''))
    reasons.push(
      'notify_required missing/unknown; severity alone does not establish a notification obligation',
    )
  if (truthy(values.notify_required ?? '')) {
    if (!values.notified_at) reasons.push('notify_required without notified_at')
    else if (!parseTemporal(values.notified_at)) reasons.push('notified_at invalid')
    else if (parseTemporal(values.recorded_at)) {
      const order = compareTemporal(values.notified_at, values.recorded_at)
      if (order == null)
        reasons.push('Notification sequence cannot be verified from supplied precision/time zones')
      else if (order < 0) reasons.push('notified_at before recorded_at')
    }
  }
  return reasons
}
export function incidentFindings(ctx: EngineContext, ids: IncidentIds): Finding[] {
  if (!hasClass(ctx, 'incidents')) return [missingSourcesFinding(ctx, ids.lifecycle, ['incidents'])]
  const incidents = periodRows(ctx, 'incidents', 'recorded_at')
  const exceptions = incidents.flatMap((incident) => {
    const reasons = lifecycleGaps(incident.values)
    return reasons.length
      ? [
          {
            ref: incident.values.incident_id || incident.locator,
            reason: reasons.join('; '),
            locator: incident.locator,
          },
        ]
      : []
  })
  return [
    makeFinding(ctx.claimById(ids.lifecycle), {
      grade: gradeCoverage(
        incidents.length,
        incidents.length - exceptions.length,
        incidents.length > 0 && exceptions.length === incidents.length,
      ),
      assessed: incidents.length,
      satisfied: incidents.length - exceptions.length,
      evidence: incidents.map((r) => pointerFromRow(r, 'recorded_at')),
      exceptions,
      exposure_rationale: `${incidents.length - exceptions.length} of ${incidents.length} in-period incidents have a closed recorded/actioned/closed sequence and notification where explicitly marked required. No notification time limit or requirement is inferred from severity.`,
      closes_with: exceptions.length
        ? 'Complete, valid lifecycle timestamps and an explicit notification-required field for each exception'
        : incidents.length
          ? 'No further artefact for this sequence check'
          : 'Incident activity in the selected period',
    }),
  ]
}

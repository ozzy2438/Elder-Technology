import { parseDate } from '../dates.ts'
import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, periodRows, rowsOf } from '../intake.ts'
import type { CanonicalRow, EngineContext, Finding } from '../types.ts'
export interface CompetencyIds {
  onDate: string
  expiredNow: string
}
function currentOn(comp: CanonicalRow, date: string): boolean {
  const from = parseDate(comp.values.valid_from)
  const to = parseDate(comp.values.valid_to)
  return Boolean(from && to && from <= to && comp.values.competency && date >= from && date <= to)
}
export function competencyFindings(ctx: EngineContext, ids: CompetencyIds): Finding[] {
  const missing = (['service_delivery', 'competency'] as const).filter((c) => !hasClass(ctx, c))
  if (missing.length)
    return [ids.onDate, ids.expiredNow].map((id) => missingSourcesFinding(ctx, id, missing))
  const deliveries = periodRows(ctx, 'service_delivery', 'service_date')
  const comps = rowsOf(ctx, 'competency')
  const exceptions = []
  const evidence = []
  const covered = new Map<string, { delivery: CanonicalRow; comp: CanonicalRow }>()
  let satisfied = 0
  for (const delivery of deliveries) {
    const worker = delivery.values.worker_id
    const service = (delivery.values.service_type ?? '').toLowerCase()
    const date = parseDate(delivery.values.service_date)
    const matches =
      worker && service
        ? comps.filter(
            (c) =>
              c.values.worker_id === worker &&
              (c.values.service_type ?? '').toLowerCase() === service,
          )
        : []
    const valid = date ? matches.find((c) => currentOn(c, date)) : undefined
    evidence.push(pointerFromRow(delivery, 'service_date'))
    if (valid) {
      satisfied += 1
      evidence.push(pointerFromRow(valid, 'valid_to'))
      covered.set(`${worker}|${service}`, { delivery, comp: valid })
      continue
    }
    const expired = date
      ? matches.find((c) => {
          const to = parseDate(c.values.valid_to)
          return to && to < date
        })
      : undefined
    if (expired) evidence.push(pointerFromRow(expired, 'valid_to'))
    exceptions.push({
      ref: `${delivery.values.record_id || delivery.locator}/${worker}/${service}`,
      reason: expired
        ? `Competency for ${service} expired on ${expired.values.valid_to}, before delivery ${date}`
        : 'No valid, fully dated competency record for this worker, service type and delivery date',
      locator: delivery.locator,
    })
  }
  const endEvidence = []
  const endExceptions = []
  for (const [key, { delivery, comp }] of covered) {
    const current = comps.find(
      (c) =>
        c.values.worker_id === delivery.values.worker_id &&
        (c.values.service_type ?? '').toLowerCase() ===
          (delivery.values.service_type ?? '').toLowerCase() &&
        currentOn(c, ctx.period.to),
    )
    endEvidence.push(pointerFromRow(current ?? comp, 'valid_to'))
    if (!current)
      endExceptions.push({
        ref: key.replace('|', '/'),
        reason: `Valid at delivery but not current at period end ${ctx.period.to}`,
        locator: comp.locator,
      })
  }
  return [
    makeFinding(ctx.claimById(ids.onDate), {
      grade: gradeCoverage(deliveries.length, satisfied, deliveries.length > 0 && satisfied === 0),
      assessed: deliveries.length,
      satisfied,
      evidence,
      exceptions,
      exposure_rationale: `${satisfied} of ${deliveries.length} in-period deliveries have named competency evidence and valid_from/valid_to covering the visit. Missing expiry/start dates are not assumed current.`,
      closes_with: exceptions.length
        ? 'Dated competency record for each exception worker and service type covering the delivery date'
        : deliveries.length
          ? 'No further artefact for this date coverage check'
          : 'Delivery activity in the selected period',
    }),
    makeFinding(ctx.claimById(ids.expiredNow), {
      grade: gradeCoverage(
        covered.size,
        covered.size - endExceptions.length,
        covered.size > 0 && endExceptions.length === covered.size,
      ),
      assessed: covered.size,
      satisfied: covered.size - endExceptions.length,
      evidence: endEvidence,
      exceptions: endExceptions,
      exposure: endExceptions.length ? 'MEDIUM' : 'LOW',
      exposure_rationale: `${covered.size - endExceptions.length} of ${covered.size} worker/service pairs valid at delivery remain current at selected period end. This check is not validity as of today.`,
      closes_with: endExceptions.length
        ? `Renewed competency covering ${ctx.period.to} for each exception worker/service pair`
        : covered.size
          ? 'No further artefact for this period-end check'
          : 'Competency covering at least one delivery date before period-end validity can be assessed',
    }),
  ]
}

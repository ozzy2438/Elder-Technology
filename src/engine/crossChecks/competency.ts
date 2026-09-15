import { claimById } from '../corpus.ts'
import { inPeriod } from '../dates.ts'
import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import type { CanonicalRow, EngineContext, Finding } from '../types.ts'

function currentOn(comp: CanonicalRow, onDate: string): boolean {
  const from = comp.values.valid_from
  const to = comp.values.valid_to
  if (!from && !to) return false
  if (from && onDate < from) return false
  if (to && onDate > to) return false
  return true
}

export function competencyFindings(ctx: EngineContext): Finding[] {
  if (!hasClass(ctx, 'service_delivery')) {
    return [
      missingSourcesFinding('CC-COMP-ON-DATE', ['service_delivery']),
      missingSourcesFinding('CC-COMP-EXPIRED-NOW', ['service_delivery']),
    ]
  }
  if (!hasClass(ctx, 'competency')) {
    return [
      missingSourcesFinding('CC-COMP-ON-DATE', ['competency']),
      missingSourcesFinding('CC-COMP-EXPIRED-NOW', ['competency']),
    ]
  }

  const onDateClaim = claimById('CC-COMP-ON-DATE')
  const expiredNowClaim = claimById('CC-COMP-EXPIRED-NOW')
  const deliveries = rowsOf(ctx, 'service_delivery').filter((r) =>
    inPeriod(r.values.service_date || null, ctx.period.from, ctx.period.to),
  )
  const comps = rowsOf(ctx, 'competency')
  const onDateExceptions = []
  const onDateEvidence = []
  let onDateOk = 0

  for (const delivery of deliveries) {
    const worker = delivery.values.worker_id
    const service = (delivery.values.service_type || '').toLowerCase()
    const date = delivery.values.service_date
    const matches = comps.filter(
      (c) => c.values.worker_id === worker && (c.values.service_type || '').toLowerCase() === service,
    )
    const valid = matches.find((c) => date && currentOn(c, date))
    if (valid) {
      onDateOk += 1
      continue
    }
    const expired = matches.find((c) => date && c.values.valid_to && c.values.valid_to < date)
    onDateEvidence.push(pointerFromRow(delivery, 'service_date'))
    if (expired) onDateEvidence.push(pointerFromRow(expired, 'valid_to'))
    onDateExceptions.push({
      ref: `${delivery.values.record_id || delivery.locator}/${worker}/${service}`,
      reason: expired
        ? `Competency for ${service} expired on ${expired.values.valid_to}, before delivery ${date}`
        : `No competency row for worker ${worker} and service type ${service} on ${date}`,
      locator: delivery.locator,
    })
  }

  const expiredNowExceptions = []
  const expiredNowEvidence = []
  const seen = new Set<string>()
  for (const delivery of deliveries) {
    const worker = delivery.values.worker_id
    const service = (delivery.values.service_type || '').toLowerCase()
    const date = delivery.values.service_date
    const key = `${worker}|${service}`
    if (seen.has(key)) continue
    const matches = comps.filter(
      (c) => c.values.worker_id === worker && (c.values.service_type || '').toLowerCase() === service,
    )
    const validOnDelivery = matches.find((c) => date && currentOn(c, date))
    if (!validOnDelivery) continue
    seen.add(key)
    const still = matches.find((c) => currentOn(c, ctx.period.to))
    if (!still) {
      expiredNowEvidence.push(pointerFromRow(validOnDelivery, 'valid_to'))
      expiredNowExceptions.push({
        ref: `${worker}/${service}`,
        reason: `Competency was valid on delivery ${date} but not current at period end ${ctx.period.to} (valid_to=${validOnDelivery.values.valid_to || 'blank'})`,
        locator: validOnDelivery.locator,
      })
    }
  }

  return [
    makeFinding(onDateClaim, {
      grade: gradeCoverage(deliveries.length, onDateOk, deliveries.length > 0 && onDateOk === 0),
      assessed: deliveries.length,
      satisfied: onDateOk,
      evidence: onDateEvidence.slice(0, 30),
      exceptions: onDateExceptions,
      exposure_rationale:
        onDateExceptions.length === 0
          ? 'Each in-period delivery has a competency row for that worker and service type covering the delivery date.'
          : `Delivery without current competency evidence on the delivery date. Loaded corpus connects workers and safe care; it does not name a competency matrix. ${onDateExceptions.length} of ${deliveries.length} deliveries have no covering competency row.`,
      closes_with: onDateExceptions.length
        ? `Dated competency record for ${onDateExceptions[0].ref} covering the delivery date`
        : 'No further artefact; competency rows already cover delivery dates',
    }),
    makeFinding(expiredNowClaim, {
      grade:
        seen.size === 0
          ? 'PRESENT'
          : gradeCoverage(
              seen.size,
              seen.size - expiredNowExceptions.length,
              seen.size > 0 && expiredNowExceptions.length === seen.size,
            ),
      assessed: seen.size,
      satisfied: seen.size === 0 ? 0 : seen.size - expiredNowExceptions.length,
      evidence:
        expiredNowEvidence.slice(0, 20).length > 0
          ? expiredNowEvidence.slice(0, 20)
          : comps.slice(0, 1).map((r) => pointerFromRow(r, 'valid_to')),
      exceptions: expiredNowExceptions,
      exposure: expiredNowExceptions.length ? 'MEDIUM' : 'LOW',
      exposure_rationale:
        expiredNowExceptions.length === 0
          ? 'Workers who were current on their delivery dates remain current at period end.'
          : `Competency expired by period end after a valid delivery-date record. This is distinct from expired-at-delivery. ${expiredNowExceptions.length} worker/service pairs.`,
      closes_with: expiredNowExceptions.length
        ? `Renewed competency for ${expiredNowExceptions[0].ref} current at ${ctx.period.to}`
        : 'No further artefact; in-period workers remain current at period end',
    }),
  ]
}

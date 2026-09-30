import { parseDate, parseMinutes } from '../dates.ts'
import {
  gradeCoverage,
  makeFinding,
  matchKey,
  missingSourcesFinding,
  pointerFromRow,
} from '../finding.ts'
import { hasClass, periodRows } from '../intake.ts'
import type { CanonicalRow, EngineContext, Finding, FindingException } from '../types.ts'

export interface BillingIds {
  unmatchedClaims: string
  unmatchedDeliveries: string
  duration: string
}
function key(row: CanonicalRow, date: string): string | null {
  const parts = [
    row.values.participant_id,
    parseDate(row.values[date]),
    row.values.worker_id,
    row.values.service_type,
  ]
  return parts.every(Boolean) ? matchKey(parts as string[]) : null
}
function grouped(rows: CanonicalRow[], date: string) {
  const groups = new Map<string, CanonicalRow[]>()
  for (const row of rows) {
    const k = key(row, date)
    if (k) groups.set(k, [...(groups.get(k) ?? []), row])
  }
  return groups
}

export function billingFindings(ctx: EngineContext, ids: BillingIds): Finding[] {
  const missing = (['billing', 'service_delivery'] as const).filter((c) => !hasClass(ctx, c))
  if (missing.length)
    return [ids.unmatchedClaims, ids.unmatchedDeliveries, ids.duration].map((id) =>
      missingSourcesFinding(ctx, id, missing),
    )
  const claims = periodRows(ctx, 'billing', 'claim_date')
  const deliveries = periodRows(ctx, 'service_delivery', 'service_date')
  const byDelivery = grouped(deliveries, 'service_date')
  const byClaim = grouped(claims, 'claim_date')
  const linkedCounts = new Map<string, number>()
  for (const claim of claims) {
    const linked = claim.values.related_record_id
    if (linked) linkedCounts.set(linked, (linkedCounts.get(linked) ?? 0) + 1)
  }
  const used = new Set<string>()
  const claimExceptions: FindingException[] = []
  const durationExceptions: FindingException[] = []
  const pairs: Array<{ claim: CanonicalRow; delivery: CanonicalRow }> = []
  for (const claim of claims) {
    const k = key(claim, 'claim_date')
    const amount = Number((claim.values.amount ?? '').replace(/[$,£]/g, ''))
    let reason = ''
    const candidates = k ? (byDelivery.get(k) ?? []) : []
    const linked = claim.values.related_record_id
    const exact = linked ? candidates.filter((d) => d.values.record_id === linked) : candidates
    if (!k || !claim.values.claim_id || !claim.values.amount || !Number.isFinite(amount)) {
      reason =
        'Claim identifier, participant, valid date, worker, service type or numeric amount is missing/invalid'
    } else if (!exact.length) {
      reason = 'No delivery record with the same participant, date, worker, and service type'
    } else if (
      exact.length !== 1 ||
      (linked && linkedCounts.get(linked) !== 1) ||
      (!linked && (byClaim.get(k!)?.length ?? 0) !== 1) ||
      used.has(exact[0].locator)
    ) {
      reason =
        'More than one possible claim/delivery pairing; provide a unique linked delivery identifier'
      ctx.open_questions.push({
        id: `pair-${claim.locator}`,
        question: `Which delivery belongs to claim ${claim.values.claim_id}? Multiple records share its matching fields.`,
        related_claim_id: ids.unmatchedClaims,
      })
    }
    if (reason) {
      claimExceptions.push({
        ref: claim.values.claim_id || claim.locator,
        reason,
        locator: claim.locator,
      })
      continue
    }
    const delivery = exact[0]
    used.add(delivery.locator)
    pairs.push({ claim, delivery })
    // Each table's hours were normalised to minutes during intake.
    const claimed = parseMinutes(claim.values.duration_minutes ?? '', 'minutes')
    const delivered = parseMinutes(delivery.values.duration_minutes ?? '', 'minutes')
    if (claimed == null || delivered == null || claimed !== delivered)
      durationExceptions.push({
        ref: claim.values.claim_id || claim.locator,
        reason:
          claimed == null || delivered == null
            ? 'Duration missing/invalid on a matched pair; equality cannot be tested'
            : `Claimed duration ${claimed} does not equal delivered duration ${delivered} minutes`,
        locator: `${claim.locator}|${delivery.locator}`,
      })
  }
  const deliveryExceptions = deliveries
    .filter((d) => !used.has(d.locator))
    .map((d) => ({
      ref: d.values.record_id || d.locator,
      reason: key(d, 'service_date')
        ? 'No uniquely matched claim for this delivery'
        : 'Delivery matching fields or date missing/invalid',
      locator: d.locator,
    }))
  const claimEvidence = claims.map((c) => pointerFromRow(c, 'claim_date'))
  const deliveryEvidence = deliveries.map((d) => pointerFromRow(d, 'service_date'))
  const pairEvidence = pairs.flatMap((p) => [
    pointerFromRow(p.claim, 'claim_date'),
    pointerFromRow(p.delivery, 'service_date'),
  ])
  return [
    makeFinding(ctx.claimById(ids.unmatchedClaims), {
      grade: gradeCoverage(claims.length, pairs.length, claims.length > 0 && pairs.length === 0),
      assessed: claims.length,
      satisfied: pairs.length,
      evidence: [...claimEvidence, ...pairs.map((p) => pointerFromRow(p.delivery, 'service_date'))],
      exceptions: claimExceptions,
      exposure_rationale: `${pairs.length} of ${claims.length} in-period claims have a unique delivery match. Keys are a product evidence requirement; amount correctness is not assessed.`,
      closes_with: claimExceptions.length
        ? 'Delivery records with matching participant, date, worker and service type; unique visit links where pairing is ambiguous'
        : claims.length
          ? 'No further artefact for this matching check'
          : 'Claim activity in the selected period',
    }),
    makeFinding(ctx.claimById(ids.unmatchedDeliveries), {
      grade: gradeCoverage(deliveries.length, used.size, deliveries.length > 0 && used.size === 0),
      assessed: deliveries.length,
      satisfied: used.size,
      evidence: [...deliveryEvidence, ...pairs.map((p) => pointerFromRow(p.claim, 'claim_date'))],
      exceptions: deliveryExceptions,
      exposure: deliveryExceptions.length ? 'MEDIUM' : 'LOW',
      exposure_rationale: `${used.size} of ${deliveries.length} in-period deliveries have a unique claim match. Unmatched delivery is distinct from unmatched claiming.`,
      closes_with: deliveryExceptions.length
        ? 'Claim records uniquely linked to each unmatched delivery, or an explanation of why no claim was raised'
        : deliveries.length
          ? 'No further artefact for this matching check'
          : 'Delivery activity in the selected period',
    }),
    makeFinding(ctx.claimById(ids.duration), {
      grade: gradeCoverage(
        pairs.length,
        pairs.length - durationExceptions.length,
        pairs.length > 0 && durationExceptions.length === pairs.length,
      ),
      assessed: pairs.length,
      satisfied: pairs.length - durationExceptions.length,
      evidence: pairEvidence,
      exceptions: durationExceptions,
      exposure_rationale: `${pairs.length - durationExceptions.length} of ${pairs.length} unique pairs have equal minutes. No tolerance is inferred from the corpus. Unmatched rows are excluded from this duration check.`,
      closes_with: durationExceptions.length
        ? 'Verified durations for both records of each exception pair'
        : pairs.length
          ? 'No further artefact for this duration check'
          : 'Uniquely matched claim and delivery records in the selected period',
    }),
  ]
}

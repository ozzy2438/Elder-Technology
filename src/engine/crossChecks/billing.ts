import { claimById } from '../corpus.ts'
import { parseMinutes } from '../dates.ts'
import { gradeCoverage, makeFinding, matchKey, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import type { CanonicalRow, EngineContext, Finding } from '../types.ts'

function deliveryKey(row: CanonicalRow): string {
  return matchKey([
    row.values.participant_id,
    row.values.service_date,
    row.values.worker_id,
    row.values.service_type,
  ])
}

function claimKey(row: CanonicalRow): string {
  return matchKey([
    row.values.participant_id,
    row.values.claim_date,
    row.values.worker_id,
    row.values.service_type,
  ])
}

function durationOf(row: CanonicalRow, field: 'duration_minutes', headerHint: string): number | null {
  return parseMinutes(row.values[field] ?? '', headerHint)
}

export function billingFindings(ctx: EngineContext): Finding[] {
  const billClaim = claimById('CC-BILL-UNMATCHED-CLAIMS')
  const delClaim = claimById('CC-BILL-UNMATCHED-DELIVERIES')
  const durClaim = claimById('CC-BILL-DURATION')

  if (!hasClass(ctx, 'billing') && !hasClass(ctx, 'service_delivery')) {
    return [
      missingSourcesFinding('CC-BILL-UNMATCHED-CLAIMS', ['billing', 'service_delivery']),
      missingSourcesFinding('CC-BILL-UNMATCHED-DELIVERIES', ['billing', 'service_delivery']),
      missingSourcesFinding('CC-BILL-DURATION', ['billing', 'service_delivery']),
    ]
  }
  if (!hasClass(ctx, 'billing')) {
    return [
      missingSourcesFinding('CC-BILL-UNMATCHED-CLAIMS', ['billing']),
      missingSourcesFinding('CC-BILL-UNMATCHED-DELIVERIES', ['billing']),
      missingSourcesFinding('CC-BILL-DURATION', ['billing']),
    ]
  }
  if (!hasClass(ctx, 'service_delivery')) {
    return [
      missingSourcesFinding('CC-BILL-UNMATCHED-CLAIMS', ['service_delivery']),
      missingSourcesFinding('CC-BILL-UNMATCHED-DELIVERIES', ['service_delivery']),
      missingSourcesFinding('CC-BILL-DURATION', ['service_delivery']),
    ]
  }

  const claims = rowsOf(ctx, 'billing')
  const deliveries = rowsOf(ctx, 'service_delivery')
  const deliveryByKey = new Map<string, CanonicalRow[]>()
  for (const row of deliveries) {
    const key = deliveryKey(row)
    const list = deliveryByKey.get(key) ?? []
    list.push(row)
    deliveryByKey.set(key, list)
  }
  const usedDeliveries = new Set<string>()
  const unmatchedClaims = []
  const durationMismatches = []
  const matchedPairs: Array<{ claim: CanonicalRow; delivery: CanonicalRow }> = []

  for (const claim of claims) {
    const key = claimKey(claim)
    const candidates = (deliveryByKey.get(key) ?? []).filter((d) => !usedDeliveries.has(d.locator))
    const delivery = candidates[0]
    if (!delivery) {
      unmatchedClaims.push(claim)
      continue
    }
    usedDeliveries.add(delivery.locator)
    matchedPairs.push({ claim, delivery })
    const claimed = durationOf(claim, 'duration_minutes', ctx.tables.billing[0]?.mapped_fields.duration_minutes ?? '')
    const delivered = durationOf(
      delivery,
      'duration_minutes',
      ctx.tables.service_delivery[0]?.mapped_fields.duration_minutes ?? '',
    )
    if (claimed == null || delivered == null || claimed !== delivered) {
      durationMismatches.push({ claim, delivery, claimed, delivered })
    }
  }

  const unmatchedDeliveries = deliveries.filter((d) => !usedDeliveries.has(d.locator))

  const unmatchedClaimFinding = makeFinding(billClaim, {
    grade: gradeCoverage(claims.length, claims.length - unmatchedClaims.length, unmatchedClaims.length === claims.length),
    assessed: claims.length,
    satisfied: claims.length - unmatchedClaims.length,
    evidence: unmatchedClaims.slice(0, 20).map((r) => pointerFromRow(r, 'claim_date')),
    exceptions: unmatchedClaims.map((r) => ({
      ref: r.values.claim_id || r.locator,
      reason: 'No delivery record with the same participant, date, worker, and service type',
      locator: r.locator,
    })),
    exposure_rationale:
      unmatchedClaims.length === 0
        ? 'Every supplied claim row has a matching delivery row on participant, date, worker, and service type.'
        : `Money appears in the claims extract without a matching delivery record. Loaded corpus confirms Support at Home charging rules exist; it does not quote matching fields. ${unmatchedClaims.length} of ${claims.length} claims are unmatched.`,
    closes_with: unmatchedClaims.length
      ? `Delivery record for claim ${unmatchedClaims[0].values.claim_id || unmatchedClaims[0].locator} on ${unmatchedClaims[0].values.claim_date || 'unknown date'} with worker, duration, and service type`
      : 'No further artefact; claim-to-delivery keys already match',
  })

  const unmatchedDeliveryFinding = makeFinding(delClaim, {
    grade: gradeCoverage(
      deliveries.length,
      deliveries.length - unmatchedDeliveries.length,
      unmatchedDeliveries.length === deliveries.length,
    ),
    assessed: deliveries.length,
    satisfied: deliveries.length - unmatchedDeliveries.length,
    evidence: unmatchedDeliveries.slice(0, 20).map((r) => pointerFromRow(r, 'service_date')),
    exceptions: unmatchedDeliveries.map((r) => ({
      ref: r.values.record_id || r.locator,
      reason: 'No claim with the same participant, date, worker, and service type',
      locator: r.locator,
    })),
    exposure: unmatchedDeliveries.length ? 'MEDIUM' : 'LOW',
    exposure_rationale:
      unmatchedDeliveries.length === 0
        ? 'Every supplied delivery row has a matching claim row.'
        : `${unmatchedDeliveries.length} of ${deliveries.length} delivery rows have no matching claim. This is unmatched delivery, not unmatched claiming.`,
    closes_with: unmatchedDeliveries.length
      ? `Claim row matching delivery ${unmatchedDeliveries[0].values.record_id || unmatchedDeliveries[0].locator} on ${unmatchedDeliveries[0].values.service_date || ''}`
      : 'No further artefact; delivery-to-claim keys already match',
  })

  const durationFinding = makeFinding(durClaim, {
    grade: gradeCoverage(
      matchedPairs.length,
      matchedPairs.length - durationMismatches.length,
      matchedPairs.length > 0 && durationMismatches.length === matchedPairs.length,
    ),
    assessed: matchedPairs.length,
    satisfied: matchedPairs.length - durationMismatches.length,
    evidence: durationMismatches.slice(0, 20).map((m) => pointerFromRow(m.claim, 'claim_date')),
    exceptions: durationMismatches.map((m) => ({
      ref: m.claim.values.claim_id || m.claim.locator,
      reason: `Claimed duration ${m.claimed ?? 'blank'} does not equal delivered duration ${m.delivered ?? 'blank'} (${m.delivery.locator})`,
      locator: `${m.claim.locator}|${m.delivery.locator}`,
    })),
    exposure_rationale:
      durationMismatches.length === 0
        ? 'Matched claim/delivery pairs have equal duration values.'
        : `Duration differs on matched claim/delivery pairs. Loaded corpus does not quote a tolerance. ${durationMismatches.length} of ${matchedPairs.length} pairs differ.`,
    closes_with: durationMismatches.length
      ? `Corrected duration on ${durationMismatches[0].claim.values.claim_id || durationMismatches[0].claim.locator} and ${durationMismatches[0].delivery.locator} so both records show the same minutes`
      : 'No further artefact; durations already match on paired rows',
  })

  return [unmatchedClaimFinding, unmatchedDeliveryFinding, durationFinding]
}

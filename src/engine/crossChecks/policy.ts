import { claimById } from '../corpus.ts'
import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import type { EngineContext, Finding, SourceClass } from '../types.ts'

const TOPIC_PRACTICE: Record<string, SourceClass> = {
  incidents: 'incidents',
  incident: 'incidents',
  competency: 'competency',
  workforce: 'competency',
  consent: 'consent',
  engagement: 'consent',
  care_plans: 'care_plans',
  care_plan: 'care_plans',
}

export function policyFindings(ctx: EngineContext): Finding[] {
  if (!hasClass(ctx, 'policies')) {
    return [
      missingSourcesFinding('CC-POLICY-CURRENCY', ['policies']),
      missingSourcesFinding('CC-POLICY-ENACTMENT', ['policies']),
    ]
  }
  const currencyClaim = claimById('CC-POLICY-CURRENCY')
  const enactmentClaim = claimById('CC-POLICY-ENACTMENT')
  const policies = rowsOf(ctx, 'policies')
  const stale = []
  const currencyEvidence = []
  let currentCount = 0
  for (const policy of policies) {
    currencyEvidence.push(pointerFromRow(policy, 'review_due'))
    const due = policy.values.review_due
    const approved = policy.values.approved_at
    const version = policy.values.version
    const reasons = []
    if (!version) reasons.push('version blank')
    if (!approved) reasons.push('approved_at blank')
    if (!due) reasons.push('review_due blank')
    if (due && due < ctx.period.to) reasons.push(`review_due ${due} is before period end ${ctx.period.to}`)
    if (reasons.length === 0) currentCount += 1
    else {
      stale.push({
        ref: policy.values.policy_id || policy.locator,
        reason: reasons.join('; '),
        locator: policy.locator,
      })
    }
  }

  const currentPolicies = policies.filter((p) => {
    const due = p.values.review_due
    return Boolean(p.values.version && p.values.approved_at && due && due >= ctx.period.to)
  })
  const enactmentExceptions = []
  const enactmentEvidence = []
  let enacted = 0
  for (const policy of currentPolicies) {
    const topic = (policy.values.topic || '').toLowerCase()
    const practiceClass = TOPIC_PRACTICE[topic]
    enactmentEvidence.push(pointerFromRow(policy, 'approved_at'))
    if (!practiceClass) {
      enactmentExceptions.push({
        ref: policy.values.policy_id || policy.locator,
        reason: `No practice-source mapping for topic "${policy.values.topic || ''}" in the supplied extracts`,
        locator: policy.locator,
      })
      continue
    }
    if (hasClass(ctx, practiceClass)) {
      enacted += 1
    } else {
      enactmentExceptions.push({
        ref: policy.values.policy_id || policy.locator,
        reason: `Current policy topic ${topic} has no ${practiceClass} practice records in the upload`,
        locator: policy.locator,
      })
    }
  }

  const currencyGrade =
    stale.length === 0
      ? 'PRESENT'
      : currentCount === 0 && stale.every((s) => s.reason.includes('review_due'))
        ? 'STALE'
        : gradeCoverage(policies.length, currentCount, currentCount === 0)

  return [
    makeFinding(currencyClaim, {
      grade: currencyGrade,
      assessed: policies.length,
      satisfied: currentCount,
      evidence: currencyEvidence.slice(0, 20),
      exceptions: stale,
      exposure: stale.length ? 'MEDIUM' : 'LOW',
      exposure_rationale:
        stale.length === 0
          ? 'Each policy row has version, approved_at, and review_due on or after period end.'
          : `Policy register rows are past review_due or missing approval/version fields. Loaded corpus does not quote review-due rules. ${stale.length} of ${policies.length} policies fail the currency check.`,
      closes_with: stale.length
        ? `Approved, versioned policy record for ${stale[0].ref} with review_due on or after ${ctx.period.to}`
        : 'No further artefact; policy register already current',
    }),
    makeFinding(enactmentClaim, {
      grade:
        currentPolicies.length === 0
          ? 'MISSING'
          : gradeCoverage(currentPolicies.length, enacted, enacted === 0),
      assessed: currentPolicies.length,
      satisfied: enacted,
      evidence: enactmentEvidence.slice(0, 20),
      exceptions: enactmentExceptions,
      exposure: enactmentExceptions.length ? 'MEDIUM' : 'LOW',
      exposure_rationale:
        enactmentExceptions.length === 0
          ? 'Each current policy topic has matching operational records in the upload.'
          : `Current policy with no practice evidence is PARTIAL, not PRESENT. ${enactmentExceptions.length} of ${currentPolicies.length} current policies have no matching practice source.`,
      closes_with: enactmentExceptions.length
        ? `Practice records for policy ${enactmentExceptions[0].ref} in the source class that matches its topic field`
        : 'No further artefact; current policies already have practice rows',
    }),
  ]
}

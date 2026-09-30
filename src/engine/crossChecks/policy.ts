import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, periodRows, rowsOf } from '../intake.ts'
import { parseDate } from '../dates.ts'
import { lifecycleGaps } from './incidents.ts'
import type { CanonicalRow, EngineContext, Finding, SourceClass } from '../types.ts'
export interface PolicyIds {
  currency: string
  enactment: string
}
const TOPICS: Record<string, { cls: SourceClass; date: string }> = {
  incidents: { cls: 'incidents', date: 'recorded_at' },
  incident: { cls: 'incidents', date: 'recorded_at' },
  safeguarding: { cls: 'incidents', date: 'recorded_at' },
  competency: { cls: 'competency', date: 'valid_from' },
  workforce: { cls: 'competency', date: 'valid_from' },
  training: { cls: 'competency', date: 'valid_from' },
  consent: { cls: 'consent', date: 'consent_date' },
  engagement: { cls: 'consent', date: 'consent_date' },
  care_plans: { cls: 'care_plans', date: 'event_date' },
  care_plan: { cls: 'care_plans', date: 'event_date' },
}
function currencyGaps(policy: CanonicalRow, end: string) {
  const reasons: string[] = []
  const approved = parseDate(policy.values.approved_at)
  const due = parseDate(policy.values.review_due)
  if (!policy.values.version) reasons.push('version blank')
  if (!approved) reasons.push('approved_at blank/invalid')
  else if (approved > end) reasons.push('approval is after selected period end')
  if (!due) reasons.push('review_due blank/invalid')
  else if (due < end) reasons.push(`review_due ${due} is before period end ${end}`)
  if (approved && due && approved > due) reasons.push('review_due precedes approval')
  return reasons
}
function completePractice(row: CanonicalRow, cls: SourceClass): boolean {
  const v = row.values
  if (cls === 'incidents') return lifecycleGaps(v).length === 0
  if (cls === 'competency') {
    const from = parseDate(v.valid_from)
    const to = parseDate(v.valid_to)
    return Boolean(v.worker_id && v.service_type && v.competency && from && to && from <= to)
  }
  if (cls === 'consent')
    return Boolean(
      v.participant_id &&
      (v.related_plan_id || v.plan_id) &&
      v.consent_type &&
      parseDate(v.consent_date),
    )
  return Boolean(v.participant_id && v.plan_id && v.event_type && parseDate(v.event_date))
}
export function policyFindings(ctx: EngineContext, ids: PolicyIds): Finding[] {
  if (!hasClass(ctx, 'policies'))
    return [ids.currency, ids.enactment].map((id) => missingSourcesFinding(ctx, id, ['policies']))
  const policies = rowsOf(ctx, 'policies')
  const stale = policies.flatMap((policy) => {
    const reasons = currencyGaps(policy, ctx.period.to)
    return reasons.length
      ? [
          {
            ref: policy.values.policy_id || policy.locator,
            reason: reasons.join('; '),
            locator: policy.locator,
          },
        ]
      : []
  })
  const current = policies.filter((p) => currencyGaps(p, ctx.period.to).length === 0)
  const exceptions = []
  const evidence = []
  let satisfied = 0
  for (const policy of current) {
    const topic = TOPICS[(policy.values.topic ?? '').toLowerCase()]
    evidence.push(pointerFromRow(policy, 'approved_at'))
    const linked = topic
      ? periodRows(ctx, topic.cls, topic.date).filter(
          (row) =>
            row.values.related_policy_id === policy.values.policy_id &&
            row.values.related_policy_version === policy.values.version &&
            Boolean(
              parseDate(row.values[topic.date]) &&
              parseDate(row.values[topic.date])! >= parseDate(policy.values.approved_at)!,
            ),
        )
      : []
    if (linked.length && linked.every((row) => completePractice(row, topic.cls))) {
      satisfied += 1
      evidence.push(...linked.map((row) => pointerFromRow(row, topic.date)))
    } else {
      evidence.push(...linked.map((row) => pointerFromRow(row, topic!.date)))
      exceptions.push({
        ref: policy.values.policy_id || policy.locator,
        reason: !topic
          ? 'No defined practice check for this policy topic'
          : !linked.length
            ? 'No in-period practice record explicitly linked to this policy and version'
            : 'Linked practice records have incomplete required dates/fields or lifecycle steps',
        locator: policy.locator,
      })
    }
  }
  return [
    makeFinding(ctx.claimById(ids.currency), {
      grade: !stale.length
        ? 'PRESENT'
        : current.length === 0 && stale.every((s) => s.reason.startsWith('review_due '))
          ? 'STALE'
          : gradeCoverage(policies.length, current.length, current.length === 0),
      assessed: policies.length,
      satisfied: current.length,
      evidence: policies.map((p) => pointerFromRow(p, 'review_due')),
      exceptions: stale,
      exposure: stale.length ? 'MEDIUM' : 'LOW',
      exposure_rationale: `${current.length} of ${policies.length} policies have version, valid approval on/before period end and review_due on/after it.`,
      closes_with: stale.length
        ? 'Approved, versioned policy register with valid dates covering selected period end'
        : 'No further artefact for this register currency check',
    }),
    makeFinding(ctx.claimById(ids.enactment), {
      grade: !current.length
        ? 'NOT_TESTABLE_FROM_DATA'
        : !exceptions.length
          ? 'PRESENT'
          : 'PARTIAL',
      assessed: current.length,
      satisfied,
      evidence,
      exceptions,
      exposure: exceptions.length ? 'MEDIUM' : 'LOW',
      exposure_rationale: `${satisfied} of ${current.length} current policies have complete practice rows explicitly linked to the policy/version. A register or unrelated activity alone does not demonstrate enactment. This limited record check does not establish that all policy requirements were followed.`,
      closes_with: exceptions.length
        ? 'Complete in-period practice records with related_policy_id and related_policy_version; policy-specific requirements still need source verification'
        : current.length
          ? 'No further artefact for this limited linked-practice check'
          : 'A current policy record before linked practice can be assessed',
    }),
  ]
}

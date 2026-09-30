import {
  uncoveredFinding,
  gradeCoverage,
  makeFinding,
  missingSourcesFinding,
  pointerFromRow,
} from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import { parseDate } from '../dates.ts'
import type { EngineContext, Finding } from '../types.ts'
export interface ClassificationIds {
  internal: string
  official: string
  officialArtefact: string
}
export function classificationFindings(ctx: EngineContext, ids: ClassificationIds): Finding[] {
  const official = uncoveredFinding(ctx, ids.official, ids.officialArtefact)
  const missing = (['participant_register', 'care_plans'] as const).filter((c) => !hasClass(ctx, c))
  if (missing.length) return [missingSourcesFinding(ctx, ids.internal, missing), official]
  const register = rowsOf(ctx, 'participant_register').filter((p) => {
    const date = parseDate(p.values.start_date)
    return !date || date <= ctx.period.to
  })
  const plans = rowsOf(ctx, 'care_plans')
  const exceptions = []
  const evidence = []
  let satisfied = 0
  let conflicts = 0
  for (const person of register) {
    const candidates = plans
      .filter(
        (p) =>
          p.values.participant_id &&
          p.values.participant_id === person.values.participant_id &&
          parseDate(p.values.event_date) &&
          p.values.event_date.slice(0, 10) <= ctx.period.to,
      )
      .sort((a, b) => a.values.event_date.localeCompare(b.values.event_date))
    const plan = candidates.at(-1)
    evidence.push(pointerFromRow(person, 'start_date'))
    if (plan) evidence.push(pointerFromRow(plan, 'event_date'))
    const a = person.values.classification?.trim()
    const b = plan?.values.classification?.trim()
    const sameDate = plan
      ? candidates.filter((p) => p.values.event_date === plan.values.event_date)
      : []
    const ambiguous = new Set(sameDate.map((p) => p.values.classification)).size > 1
    if (!a || !b || !person.values.participant_id || ambiguous) {
      exceptions.push({
        ref: person.values.participant_id || person.locator,
        reason: ambiguous
          ? 'Multiple latest plan records disagree; no classification was selected'
          : 'Register classification or dated care-plan classification missing at period end',
        locator: plan ? `${person.locator}|${plan.locator}` : person.locator,
      })
      if (ambiguous) evidence.push(...sameDate.map((p) => pointerFromRow(p, 'event_date')))
    } else if (a !== b) {
      conflicts += 1
      exceptions.push({
        ref: person.values.participant_id,
        reason: `Participant register has ${a}; care plan ${plan!.values.plan_id || plan!.locator} has ${b}. Both retained; neither preferred.`,
        locator: `${person.locator}|${plan!.locator}`,
      })
    } else satisfied += 1
  }
  return [
    makeFinding(ctx.claimById(ids.internal), {
      grade: conflicts
        ? 'CONTRADICTED'
        : gradeCoverage(register.length, satisfied, register.length > 0 && satisfied === 0),
      assessed: register.length,
      satisfied,
      evidence,
      exceptions,
      exposure_rationale: `${satisfied} of ${register.length} supplied participant register rows match the latest dated care-plan value on/before period end. Missing values remain gaps. The register's classification effective date is not established by commencement date.`,
      closes_with: exceptions.length
        ? 'Dated classification evidence reconciling register and care plan for every exception; retain both source values until resolved'
        : register.length
          ? 'No further artefact for this source-coherence check'
          : 'Participant and plan records applicable to the selected period',
    }),
    official,
  ]
}

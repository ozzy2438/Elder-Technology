import { uncoveredFinding, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import type { EngineContext, Finding } from '../types.ts'

export interface ClassificationIds {
  internal: string
  official: string
  officialArtefact: string
}

function latestPlanClassification(plans: ReturnType<typeof rowsOf>, participantId: string) {
  const rows = plans
    .filter((p) => p.values.participant_id === participantId && p.values.classification)
    .sort((a, b) => (a.values.event_date || '').localeCompare(b.values.event_date || ''))
  return rows[rows.length - 1] ?? null
}

export function classificationFindings(ctx: EngineContext, ids: ClassificationIds): Finding[] {
  const official = uncoveredFinding(ctx, ids.official, ids.officialArtefact)

  if (!hasClass(ctx, 'participant_register')) {
    return [missingSourcesFinding(ctx, ids.internal, ['participant_register']), official]
  }
  if (!hasClass(ctx, 'care_plans')) {
    return [missingSourcesFinding(ctx, ids.internal, ['care_plans']), official]
  }

  const claim = ctx.claimById(ids.internal)
  const register = rowsOf(ctx, 'participant_register')
  const plans = rowsOf(ctx, 'care_plans')
  const exceptions = []
  const evidence = []
  let assessed = 0
  let satisfied = 0
  for (const person of register) {
    const plan = latestPlanClassification(plans, person.values.participant_id)
    if (!plan) continue
    assessed += 1
    evidence.push(pointerFromRow(person, 'start_date'))
    evidence.push(pointerFromRow(plan, 'event_date'))
    const a = (person.values.classification || '').trim()
    const b = (plan.values.classification || '').trim()
    if (a && b && a !== b) {
      exceptions.push({
        ref: person.values.participant_id,
        reason: `Participant register has ${a}; care plan ${plan.values.plan_id || plan.locator} has ${b}. Both retained; neither preferred.`,
        locator: `${person.locator}|${plan.locator}`,
      })
    } else {
      satisfied += 1
    }
  }

  const grade =
    assessed === 0 ? 'MISSING' : exceptions.length > 0 ? 'CONTRADICTED' : 'PRESENT'

  return [
    makeFinding(claim, {
      grade,
      assessed,
      satisfied,
      evidence: evidence.slice(0, 30),
      exceptions,
      exposure_rationale:
        exceptions.length === 0
          ? 'Where both sources have a classification, the values match.'
          : `Two sources disagree on classification. Both values are reported. ${exceptions.length} of ${assessed} participants with both sources conflict.`,
      closes_with: exceptions.length
        ? `Single dated classification artefact that reconciles register and care plan for ${exceptions[0].ref} (do not silently pick one)`
        : 'No further artefact; register and care-plan classifications already match',
    }),
    official,
  ]
}

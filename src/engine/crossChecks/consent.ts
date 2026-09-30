import { parseDate, truthy } from '../dates.ts'
import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, periodRows, rowsOf } from '../intake.ts'
import type { CanonicalRow, EngineContext, Finding } from '../types.ts'

export interface ConsentIds {
  link: string
}
const isCreate = (s: string) => /create|initial|new/i.test(s)
const isChange = (s: string) => /change|amend|update|variation/i.test(s)
function needsConsent(row: CanonicalRow): boolean {
  return (
    isCreate(row.values.event_type ?? '') ||
    (isChange(row.values.event_type ?? '') &&
      (!row.values.is_material || truthy(row.values.is_material)))
  )
}
function typeFits(event: string, consent: string): boolean {
  if (isCreate(event)) return isCreate(consent) && !isChange(consent)
  return isChange(consent) || /material/i.test(consent)
}

export function consentFindings(ctx: EngineContext, ids: ConsentIds): Finding[] {
  const missing = (['care_plans', 'consent'] as const).filter((c) => !hasClass(ctx, c))
  if (missing.length) return [missingSourcesFinding(ctx, ids.link, missing)]
  const allEvents = rowsOf(ctx, 'care_plans').filter(needsConsent)
  const events = periodRows(ctx, 'care_plans', 'event_date').filter(needsConsent)
  const consents = rowsOf(ctx, 'consent')
  const exceptions = []
  const evidence = []
  const used = new Set<string>()
  let satisfied = 0
  for (const event of events) {
    const eventDay = parseDate(event.values.event_date)
    const matches = consents.filter((consent) => {
      const plan = consent.values.related_plan_id || consent.values.plan_id
      const day = parseDate(consent.values.consent_date)
      if (!eventDay || !day || !event.values.plan_id || !event.values.participant_id || !plan)
        return false
      if (
        plan !== event.values.plan_id ||
        event.values.participant_id !== consent.values.participant_id ||
        used.has(consent.locator)
      )
        return false
      if (
        !typeFits(event.values.event_type ?? '', consent.values.consent_type ?? '') ||
        day > eventDay
      )
        return false
      // An explicit event link can establish earlier consent. Without one, only same-day
      // evidence with a unique plan/event is usable; a prior generic change is not reused.
      if (consent.values.related_event_id)
        return Boolean(
          event.values.event_id && consent.values.related_event_id === event.values.event_id,
        )
      return (
        day === eventDay &&
        allEvents.filter(
          (e) =>
            e.values.plan_id === event.values.plan_id &&
            e.values.participant_id === event.values.participant_id &&
            parseDate(e.values.event_date) === eventDay &&
            typeFits(e.values.event_type ?? '', consent.values.consent_type ?? ''),
        ).length === 1
      )
    })
    evidence.push(pointerFromRow(event, 'event_date'))
    if (matches.length === 1) {
      satisfied += 1
      used.add(matches[0].locator)
      evidence.push(pointerFromRow(matches[0], 'consent_date'))
    } else {
      exceptions.push({
        ref: `${event.values.participant_id}/${event.values.plan_id}/${event.values.event_type}`,
        reason:
          matches.length > 1
            ? 'Multiple consent rows could relate to this event; confirm the event link'
            : 'No uniquely linked, dated consent for this specific plan event; prior generic consent is not reused',
        locator: event.locator,
      })
    }
    if (isChange(event.values.event_type ?? '') && !event.values.is_material)
      ctx.open_questions.push({
        id: `material-${event.locator}`,
        question: `Confirm whether plan change at ${event.locator} is material; it is included conservatively.`,
        related_claim_id: ids.link,
      })
  }
  return [
    makeFinding(ctx.claimById(ids.link), {
      grade: gradeCoverage(events.length, satisfied, events.length > 0 && satisfied === 0),
      assessed: events.length,
      satisfied,
      evidence,
      exceptions,
      exposure_rationale: `${satisfied} of ${events.length} in-period create/material-change events have specific plan and event consent evidence. Same-day matching without an event ID is a product convention, not a quoted legal time limit.`,
      closes_with: exceptions.length
        ? 'Dated consent with participant, related_plan_id and related_event_id for the specific event; earlier consent requires an explicit event link'
        : events.length
          ? 'No further artefact for this linkage check'
          : 'Care-plan create or material-change activity in the selected period',
    }),
  ]
}

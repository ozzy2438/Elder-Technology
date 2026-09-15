import { claimById } from '../corpus.ts'
import { truthy } from '../dates.ts'
import { gradeCoverage, makeFinding, missingSourcesFinding, pointerFromRow } from '../finding.ts'
import { hasClass, rowsOf } from '../intake.ts'
import type { CanonicalRow, EngineContext, Finding } from '../types.ts'

function isCreate(eventType: string): boolean {
  return /create|initial|new/.test(eventType.toLowerCase())
}

function isChange(eventType: string): boolean {
  return /change|amend|update|variation/.test(eventType.toLowerCase())
}

function needsConsent(row: CanonicalRow): boolean {
  const event = row.values.event_type ?? ''
  if (isCreate(event)) return true
  if (isChange(event) && (truthy(row.values.is_material ?? '') || row.values.is_material === '')) {
    if (row.values.is_material === '') return isChange(event)
    return truthy(row.values.is_material)
  }
  return false
}

function consentTypeFits(eventType: string, consentType: string): boolean {
  const event = eventType.toLowerCase()
  const consent = consentType.toLowerCase()
  if (isCreate(event)) {
    return /create|initial|new/.test(consent) && !/change|amend|variation/.test(consent)
  }
  if (isChange(event)) {
    return /change|amend|update|variation|material/.test(consent)
  }
  return consent === event
}

function consentMatches(event: CanonicalRow, consent: CanonicalRow): boolean {
  if (event.values.participant_id !== consent.values.participant_id) return false
  const plan = event.values.plan_id
  const related = consent.values.related_plan_id || consent.values.plan_id
  if (plan && related && plan !== related) return false
  if (!consentTypeFits(event.values.event_type || '', consent.values.consent_type || '')) {
    return false
  }
  const eventDate = event.values.event_date
  const consentDate = consent.values.consent_date
  if (!eventDate || !consentDate) return false
  return consentDate <= eventDate
}

export function consentFindings(ctx: EngineContext): Finding[] {
  if (!hasClass(ctx, 'care_plans')) {
    return [missingSourcesFinding('CC-CONSENT-LINK', ['care_plans'])]
  }
  if (!hasClass(ctx, 'consent')) {
    return [missingSourcesFinding('CC-CONSENT-LINK', ['consent'])]
  }
  const claim = claimById('CC-CONSENT-LINK')
  const events = rowsOf(ctx, 'care_plans').filter(needsConsent)
  const consents = rowsOf(ctx, 'consent')
  const exceptions = []
  const evidence = []
  let satisfied = 0
  for (const event of events) {
    const match = consents.find((c) => consentMatches(event, c))
    if (match) {
      satisfied += 1
      evidence.push(pointerFromRow(match, 'consent_date'))
    } else {
      exceptions.push({
        ref: `${event.values.participant_id}/${event.values.plan_id}/${event.values.event_type}`,
        reason: `No dated consent/engagement row for this ${event.values.event_type || 'plan event'} on or before ${event.values.event_date || 'unknown date'}`,
        locator: event.locator,
      })
      evidence.push(pointerFromRow(event, 'event_date'))
    }
  }
  return [
    makeFinding(claim, {
      grade: gradeCoverage(events.length, satisfied, events.length > 0 && satisfied === 0),
      assessed: events.length,
      satisfied,
      evidence: evidence.slice(0, 30),
      exceptions,
      exposure_rationale:
        exceptions.length === 0
          ? 'Each create and material-change care-plan row has a consent row on or before the event date for the same participant and plan.'
          : `Unlinked material care-plan events. Loaded corpus speaks to needs, preferences, rights, and tailored care; it does not name a consent form. ${exceptions.length} of ${events.length} events have no linked consent row.`,
      closes_with: exceptions.length
        ? `Dated consent/engagement record for ${exceptions[0].ref} on or before the event date, with related_plan_id matching the care plan`
        : 'No further artefact; create and material-change events already have dated consent rows',
    }),
  ]
}

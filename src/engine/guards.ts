import type { EvidencePosition, Finding } from './types.ts'
import { redactKnownNames } from './redact.ts'

const FORBIDDEN = [
  /\bnon[-\s]?compliant\b/i,
  /\bcompliant\b/i,
  /\bwill pass\b/i,
  /\bwill fail\b/i,
  /\bconformance\b/i,
  /\bnon[-\s]?conformance\b/i,
]

export function forbiddenHits(text: string, extra: RegExp[] = []): string[] {
  const hits: string[] = []
  for (const re of [...FORBIDDEN, ...extra]) {
    const m = text.match(re)
    if (m) hits.push(m[0])
  }
  return hits
}

export function assertPointers(findings: Finding[]): string[] {
  const errors: string[] = []
  for (const finding of findings) {
    if (finding.grade === 'NOT_TESTABLE_FROM_DATA') {
      if (finding.evidence.length === 0 && finding.exceptions.length === 0) {
        errors.push(`${finding.id} has no pointer (intake/corpus locator required)`)
      }
      continue
    }
    const hasPointer =
      finding.evidence.length > 0 ||
      finding.exceptions.some((ex) => Boolean(ex.locator))
    if (!hasPointer) errors.push(`${finding.id} has no pointer`)
  }
  return errors
}

function narrativeBlob(position: EvidencePosition): string {
  return JSON.stringify({
    findings: position.findings.map((f) => ({
      grade: f.grade,
      exposure_rationale: f.exposure_rationale,
      closes_with: f.closes_with,
      exceptions: f.exceptions,
      testable_claim: f.testable_claim,
      standard: f.standard,
      outcome: f.outcome,
    })),
    open_questions: position.open_questions,
    unassessable: position.intake.unassessable_requirements,
  })
}

export function sanitisePosition(
  position: EvidencePosition,
  names: string[] = [],
  extraForbidden: RegExp[] = [],
): EvidencePosition {
  const json = redactKnownNames(JSON.stringify(position), names)
  const parsed = JSON.parse(json) as EvidencePosition
  const blob = JSON.stringify(parsed)
  const hits = forbiddenHits(blob)
  if (hits.length > 0) {
    throw new Error(`Forbidden language in evidence position: ${hits.join(', ')}`)
  }
  if (/%/.test(blob)) {
    throw new Error('Percentage scores are forbidden in the evidence position')
  }
  const extraHits = extraForbidden.length > 0 ? forbiddenHits(narrativeBlob(parsed), extraForbidden) : []
  if (extraHits.length > 0) {
    throw new Error(`Forbidden pack language in evidence position: ${extraHits.join(', ')}`)
  }
  const pointerErrors = assertPointers(parsed.findings)
  if (pointerErrors.length > 0) {
    throw new Error(pointerErrors.join('; '))
  }
  return parsed
}

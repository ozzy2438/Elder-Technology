import { claimById } from './corpus.ts'
import type { CorpusClaim, Exposure, Finding, FindingException, EvidencePointer, Grade } from './types.ts'
import { redactExtract } from './redact.ts'
import type { CanonicalRow } from './types.ts'

export function pointerFromRow(row: CanonicalRow, dateField: string): EvidencePointer {
  return {
    source_file: row.source_file,
    locator: row.locator,
    date: row.values[dateField] || '',
    extract: redactExtract(row.values),
  }
}

export function makeFinding(
  claim: CorpusClaim,
  parts: {
    grade: Grade
    assessed: number
    satisfied: number
    evidence: EvidencePointer[]
    exceptions: FindingException[]
    exposure?: Exposure
    exposure_rationale: string
    closes_with: string
  },
): Finding {
  return {
    id: claim.id,
    standard: claim.standard,
    outcome: claim.outcome,
    testable_claim: claim.testable_claim,
    grade: parts.grade,
    coverage: { assessed: parts.assessed, satisfied: parts.satisfied },
    evidence: parts.evidence,
    exceptions: parts.exceptions,
    exposure: parts.exposure ?? (parts.grade === 'PRESENT' ? 'LOW' : claim.default_exposure_if_gap),
    exposure_rationale: parts.exposure_rationale,
    closes_with: parts.closes_with,
  }
}

export function uncoveredFinding(id: string, extra: string): Finding {
  const claim = claimById(id)
  const pointer = claim.corpus_pointers[0]
  return makeFinding(claim, {
    grade: 'NOT_TESTABLE_FROM_DATA',
    assessed: 0,
    satisfied: 0,
    evidence: [
      {
        source_file: pointer.source_id,
        locator: pointer.locator,
        date: '',
        extract: pointer.quote,
      },
    ],
    exceptions: [],
    exposure: 'MEDIUM',
    exposure_rationale: `${claim.corpus_note} ${extra}`.trim(),
    closes_with: extra,
  })
}

export function missingSourcesFinding(
  id: string,
  missing: string[],
): Finding {
  const claim = claimById(id)
  return makeFinding(claim, {
    grade: 'NOT_TESTABLE_FROM_DATA',
    assessed: 0,
    satisfied: 0,
    evidence: [
      {
        source_file: '(intake)',
        locator: `missing:${missing.join(',')}`,
        date: '',
        extract: `No supplied table for ${missing.join(', ')}`,
      },
    ],
    exceptions: missing.map((m) => ({
      ref: m,
      reason: 'source class not supplied',
      locator: `intake:missing:${m}`,
    })),
    exposure: claim.default_exposure_if_gap,
    exposure_rationale: `Cannot test this claim because ${missing.join(', ')} was not in the upload.`,
    closes_with: `Export of ${missing.join(' and ')} covering the analysis period`,
  })
}

export function gradeCoverage(assessed: number, satisfied: number, allMissing: boolean): Grade {
  if (assessed === 0) return 'MISSING'
  if (allMissing) return 'MISSING'
  if (satisfied === assessed) return 'PRESENT'
  return 'PARTIAL'
}

export function matchKey(parts: Array<string | undefined>): string {
  return parts.map((p) => (p ?? '').trim().toLowerCase().replace(/\s+/g, '_')).join('|')
}

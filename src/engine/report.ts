import { resolvePack } from '../jurisdictions/registry.ts'
import type { EvidencePosition, Finding, OpenQuestion } from './types.ts'

const EXPOSURE_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export function sortFindings(findings: Finding[], weights: Record<string, number> = {}): Finding[] {
  return [...findings].sort((a, b) => {
    const exp = EXPOSURE_ORDER[a.exposure] - EXPOSURE_ORDER[b.exposure]
    if (exp !== 0) return exp
    const wa = weights[a.id] ?? 0
    const wb = weights[b.id] ?? 0
    if (wb !== wa) return wb - wa
    return a.id.localeCompare(b.id)
  })
}

export function leadSentences(
  findings: Finding[],
  headline: (finding: Finding) => string,
  weights: Record<string, number>,
): Array<{ id: string; sentence: string }> {
  return sortFindings(findings, weights)
    .filter((f) => f.grade !== 'PRESENT')
    .slice(0, 5)
    .map((f) => {
      const exception = f.exceptions[0]
      const matchedEvidence = exception
        ? f.evidence.find((e) => e.locator === exception.locator)
        : undefined
      const pointer =
        exception?.locator || f.evidence[0]?.locator || f.evidence[0]?.source_file || 'no locator'
      const date = matchedEvidence?.date || (exception ? undefined : f.evidence[0]?.date)
      const dateBit = date ? `, date ${date}` : ''
      return {
        id: f.id,
        sentence: `${f.id}: ${headline(f)} Pointer: ${pointer}${dateBit}.`,
      }
    })
}

export function uniqueQuestions(questions: OpenQuestion[]): OpenQuestion[] {
  const seen = new Set<string>()
  const out: OpenQuestion[] = []
  for (const q of questions) {
    if (seen.has(q.id) || !q.question) continue
    seen.add(q.id)
    out.push(q)
  }
  return out
}

export function coverageLabel(assessed: number, satisfied: number): string {
  return `${satisfied} of ${assessed}`
}

export function positionToHuman(position: EvidencePosition): {
  lead: Array<{ id: string; sentence: string }>
  table: Finding[]
} {
  const pack = resolvePack(position.run.pack_id)
  return {
    lead: leadSentences(position.findings, pack.headline, pack.claimWeights),
    table: sortFindings(position.findings, pack.claimWeights),
  }
}

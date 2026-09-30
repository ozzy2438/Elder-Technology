import { isNameHeader, normaliseHeader } from './redact.ts'
import type { SourceClass } from './types.ts'

export type ClassFields = Record<Exclude<SourceClass, 'unknown'>, string[]>

export interface ColumnMaps {
  classFields: ClassFields
  synonyms: Record<string, string[]>
  uniqueHints: Partial<Record<Exclude<SourceClass, 'unknown'>, string[]>>
}

export function mapHeaders(
  headers: string[],
  synonyms: Record<string, string[]>,
): {
  mapping: Record<string, string>
  reverse: Record<string, string>
} {
  const mapping: Record<string, string> = {}
  const reverse: Record<string, string> = {}
  for (const header of headers) {
    if (isNameHeader(header)) continue
    const norm = normaliseHeader(header)
    for (const [canonical, aliases] of Object.entries(synonyms)) {
      if (mapping[canonical]) continue
      if (aliases.includes(norm) || norm === canonical) {
        mapping[canonical] = header
        reverse[header] = canonical
        break
      }
    }
  }
  return { mapping, reverse }
}

export function scoreClass(
  headers: string[],
  maps: ColumnMaps,
): { source_class: SourceClass; confidence: number } {
  const { mapping } = mapHeaders(headers, maps.synonyms)
  const mapped = new Set(Object.keys(mapping))
  let best: SourceClass = 'unknown'
  let bestScore = 0
  let second = 0
  for (const [cls, fields] of Object.entries(maps.classFields) as Array<
    [Exclude<SourceClass, 'unknown'>, string[]]
  >) {
    const hits = fields.filter((f) => mapped.has(f)).length
    const unique = (maps.uniqueHints[cls] ?? []).filter((f) => mapped.has(f)).length
    const score = hits + unique * 2
    if (score > bestScore) {
      second = bestScore
      bestScore = score
      best = cls
    } else if (score > second) {
      second = score
    }
  }
  if (bestScore < 3) return { source_class: 'unknown', confidence: 0 }
  const confidence = Math.min(1, (bestScore - second) / 8 + hitsRatio(best, mapped, maps.classFields))
  return { source_class: best, confidence: Number(confidence.toFixed(2)) }
}

function hitsRatio(
  cls: SourceClass,
  mapped: Set<string>,
  classFields: ClassFields,
): number {
  if (cls === 'unknown') return 0
  const fields = classFields[cls]
  return fields.filter((f) => mapped.has(f)).length / fields.length
}

export function requiredForClass(cls: SourceClass, maps: ColumnMaps): string[] {
  if (cls === 'unknown') return []
  return maps.classFields[cls]
}

import type { ColumnMaps } from './columns.ts'
import type { CorpusClaim, EngineContext, Finding, OpenQuestion } from './types.ts'

export interface CorpusManifest {
  corpus_id: string
  retrieved_at: string
  in_scope: string
  gaps_explicit: string[]
  sources: Array<{
    id: string
    title: string
    publisher: string
    url: string
    retrieved_at: string
    licence_note: string
    page_last_updated?: string
  }>
}

export interface PackDemo {
  provider_ref: string
  period: { from: string; to: string }
  files: () => File[]
  drop_file: string
  drop_label: string
}

export interface JurisdictionPack {
  id: string
  label: string
  market: string
  kicker: string
  locale: string
  banner: string
  corpus: CorpusManifest
  claims: CorpusClaim[]
  columns: ColumnMaps
  runChecks: (ctx: EngineContext) => Finding[]
  packQuestions: OpenQuestion[]
  headline: (finding: Finding) => string
  claimWeights: Record<string, number>
  extraForbidden: RegExp[]
  demo: PackDemo
}

export function claimById(pack: JurisdictionPack, id: string): CorpusClaim {
  const claim = pack.claims.find((c) => c.id === id)
  if (!claim) throw new Error(`Corpus does not include claim ${id}`)
  return claim
}

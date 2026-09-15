import type { CorpusClaim } from './types.ts'
import claimsDoc from '../../corpus/graph/claims.json'
import manifestDoc from '../../corpus/manifest.json'

export const corpusManifest = manifestDoc
export const corpusClaims: CorpusClaim[] = claimsDoc.claims as CorpusClaim[]

export function claimById(id: string): CorpusClaim {
  const claim = corpusClaims.find((c) => c.id === id)
  if (!claim) throw new Error(`Corpus does not include claim ${id}`)
  return claim
}

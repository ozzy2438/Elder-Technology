import { auSahPack } from './au-sah/pack.ts'
import { engCqcPack } from './eng-cqc-homecare/pack.ts'
import type { JurisdictionPack } from '../engine/pack.ts'

export const PACKS: JurisdictionPack[] = [auSahPack, engCqcPack]
export const DEFAULT_PACK = auSahPack

export function resolvePack(id?: string): JurisdictionPack {
  if (!id) return DEFAULT_PACK
  const found = PACKS.find((pack) => pack.id === id)
  if (!found) throw new Error(`Unknown jurisdiction pack ${id}`)
  return found
}

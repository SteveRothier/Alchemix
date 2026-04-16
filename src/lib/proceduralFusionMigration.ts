import type { Vial } from '../types'

/** Anciennes fioles générées hors catalogue (`dyn-sp-*`, `dyn-el-*`, `dyn-*` legacy). */
export function isProceduralLegacyFusionVialId(id: string): boolean {
  const t = id.trim()
  if (t.startsWith('dyn-sp-')) return true
  if (/^dyn-el-\d+-\d+$/.test(t)) return true
  if (t.startsWith('dyn-')) return true
  return false
}

export function migrateProceduralFusionVialsFromStore(
  vials: Record<string, Vial>,
  offeringUseCount: Record<string, number>,
): void {
  for (const id of Object.keys(vials)) {
    if (isProceduralLegacyFusionVialId(id)) {
      delete vials[id]
    }
  }
  for (const id of Object.keys(offeringUseCount)) {
    if (isProceduralLegacyFusionVialId(id)) {
      delete offeringUseCount[id]
    }
  }
}

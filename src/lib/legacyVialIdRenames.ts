import { STARTER_VIAL_DEFINITIONS } from '../data/starterVials'
import type { Vial } from '../types'

/** Anciens ids persistés (localStorage) → ids actuels du code source. */
const LEGACY_VIAL_ID_RENAMES: Record<string, string> = {
  'el-nature': 'el-grass',
}

const STARTER_DISPLAY_NAME_BY_ID = new Map(
  STARTER_VIAL_DEFINITIONS.map((d) => [d.id, d.name] as const),
)

export function applyLegacyVialIdRename(id: string): string {
  const t = id.trim()
  return LEGACY_VIAL_ID_RENAMES[t] ?? id
}

/**
 * Libellé labo / inventaire : les starters viennent toujours des définitions source
 * (évite un vieux `name` persisté ou un id `el-nature` encore en mémoire).
 */
export function resolveLabVialDisplayName(vial: Pick<Vial, 'id' | 'name'>): string {
  const fromId = STARTER_DISPLAY_NAME_BY_ID.get(vial.id)
  if (fromId) return fromId
  const legacyId = applyLegacyVialIdRename(vial.id)
  const fromLegacy = STARTER_DISPLAY_NAME_BY_ID.get(legacyId)
  if (fromLegacy) return fromLegacy
  return vial.name
}

/** Met à jour en place les fioles labo et compteurs d’offrande (persist Zustand v3+). */
export function migrateElNatureToGrassInStore(
  vials: Record<string, Vial>,
  offeringUseCount: Record<string, number>,
): void {
  if (!vials['el-nature']) return

  const oldNature = vials['el-nature']!
  delete vials['el-nature']

  if (!vials['el-grass']) {
    const def = STARTER_VIAL_DEFINITIONS.find((d) => d.id === 'el-grass')
    vials['el-grass'] = def
      ? { ...def, discoveredAt: oldNature.discoveredAt }
      : { ...oldNature, id: 'el-grass', name: 'Grass' }
  }

  const nUses = offeringUseCount['el-nature']
  if (nUses !== undefined) {
    delete offeringUseCount['el-nature']
    offeringUseCount['el-grass'] = (offeringUseCount['el-grass'] ?? 0) + nUses
  }
}

/**
 * Réaligne nom / description / icône / rareté des starters persistés sur le code source,
 * en conservant `discoveredAt` et le liquide (personnalisation joueur).
 */
export function reconcileStarterVialsWithDefinitions(
  vials: Record<string, Vial>,
): void {
  for (const def of STARTER_VIAL_DEFINITIONS) {
    const v = vials[def.id]
    if (!v) continue
    vials[def.id] = {
      ...def,
      discoveredAt: v.discoveredAt,
      liquid: v.liquid,
    }
  }
}

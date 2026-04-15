import { SIMPLE_ELEMENT_BY_INDEX_PAIR } from './simpleElementData'

/** Slugs déjà utilisés par des recettes `craft-*` statiques du catalogue. */
const LEGACY_CRAFT_SLUGS = new Set(['abyss', 'crystal', 'twilight'])

const CRAFT_ID_TO_PAIR_KEY = new Map<string, string>()

/** Id stable `craft-{mot}` (ou `craft-amalgam-{mot}` si collision avec un craft catalogue). */
export function canonicalDynamicElementCraftId(lo: number, hi: number): string {
  const L = Math.min(lo, hi)
  const H = Math.max(lo, hi)
  const word = SIMPLE_ELEMENT_BY_INDEX_PAIR[`${L}-${H}`] ?? 'Dross'
  const slug = word.toLowerCase()
  if (LEGACY_CRAFT_SLUGS.has(slug)) {
    return `craft-amalgam-${slug}`
  }
  return `craft-${slug}`
}

for (let lo = 0; lo < 8; lo++) {
  for (let hi = lo; hi < 8; hi++) {
    const id = canonicalDynamicElementCraftId(lo, hi)
    CRAFT_ID_TO_PAIR_KEY.set(id, `${lo}-${hi}`)
  }
}

/** Ids `craft-*` réservés aux amalgames dynamiques (profil d’ingrédient dérivé des indices). */
export const CANONICAL_DYNAMIC_ELEMENT_CRAFT_IDS: readonly string[] =
  Array.from(CRAFT_ID_TO_PAIR_KEY.keys())

export function isCanonicalDynamicElementCraftId(id: string): boolean {
  return CRAFT_ID_TO_PAIR_KEY.has(id)
}

/** Clé d’indices `"lo-hi"` (affinités), ou `null` si ce n’est pas un amalgam dynamique canonique. */
export function dynamicElementCraftPairKey(id: string): string | null {
  return CRAFT_ID_TO_PAIR_KEY.get(id) ?? null
}

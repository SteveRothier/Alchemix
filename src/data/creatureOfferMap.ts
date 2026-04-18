import { CRAFTED_VIAL_TEMPLATES } from './craftedVials'

/**
 * Ids d’offrande explicites (alias historiques `sp-*`, etc.) → créature trophée.
 * Hors table : déduction depuis les recettes créature A===B du catalogue.
 */
export const OFFERING_ID_TO_CREATURE_ID: Partial<Record<string, string>> = {
  'sp-fireball': 'creature-ifrit',
  'sp-inferno-wave': 'creature-ifrit',
  'sp-icy-wind': 'creature-yeti',
  'sp-holy-light': 'creature-seraphim',
  'sp-dark-pulse': 'creature-lich',
  'sp-nature-wrath': 'creature-ent',
  'sp-stone-wall': 'creature-golem',
  'sp-swamp-curse': 'creature-ogre',
  'sp-chain-lightning': 'creature-bahamut',
  'sp-infernal-cyclone': 'creature-ifrit',
  'sp-void-rift': 'creature-lich',
  'sp-plague-touch': 'creature-ogre',
}

const OFFERING_ID_FROM_CREATURE_RECIPES: Partial<Record<string, string>> = (() => {
  const out: Partial<Record<string, string>> = {}
  const entries = Object.entries(CRAFTED_VIAL_TEMPLATES).sort(([a], [b]) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  )
  for (const [creatureId, t] of entries) {
    if (t.type !== 'creature' || !t.recipe) continue
    const a = t.recipe.ingredientA
    const b = t.recipe.ingredientB
    if (!a || a !== b) continue
    if (!out[a]) out[a] = creatureId
  }
  return out
})()

export function getCreatureIdFromOfferedElement(vialId: string): string | null {
  return OFFERING_ID_TO_CREATURE_ID[vialId] ?? OFFERING_ID_FROM_CREATURE_RECIPES[vialId] ?? null
}

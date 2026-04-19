import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'

function normalizeVialRef(id: string): string {
  return id.trim()
}

function pairKey(idA: string, idB: string): string {
  return [normalizeVialRef(idA), normalizeVialRef(idB)].sort().join('|')
}

const SEED_RESULT_BY_PAIR = new Map<string, string>()

/*
 * On exclut volontairement les templates créatures : leurs recettes (ex. stone+stone → golem)
 * existent uniquement pour le système d’offrande (trophée) et ne doivent pas être fusionnables
 * dans le laboratoire. Voir `creatureOfferMap.ts` pour la résolution des offrandes.
 */
for (const [resultId, tpl] of Object.entries(CRAFTED_VIAL_TEMPLATES)) {
  if (tpl.type === 'creature') continue
  const recipes = tpl.recipes?.length ? tpl.recipes : tpl.recipe ? [tpl.recipe] : []
  for (const r of recipes) {
    const { ingredientA, ingredientB } = r
    if (!ingredientA || !ingredientB) continue
    SEED_RESULT_BY_PAIR.set(pairKey(ingredientA, ingredientB), resultId)
  }
}

/** Identifiant de fiole seed si la paire est connue, sinon `null`. */
export function lookupSeedResultId(vialIdA: string, vialIdB: string): string | null {
  return SEED_RESULT_BY_PAIR.get(pairKey(vialIdA, vialIdB)) ?? null
}

export { normalizeVialRef, pairKey }

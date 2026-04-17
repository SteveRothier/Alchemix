import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'

function normalizeVialRef(id: string): string {
  return id.trim()
}

function pairKey(idA: string, idB: string): string {
  return [normalizeVialRef(idA), normalizeVialRef(idB)].sort().join('|')
}

const SEED_RESULT_BY_PAIR = new Map<string, string>()

for (const [resultId, tpl] of Object.entries(CRAFTED_VIAL_TEMPLATES)) {
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

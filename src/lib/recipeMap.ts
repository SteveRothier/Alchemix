import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'

function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('|')
}

const SEED_RESULT_BY_PAIR = new Map<string, string>()

for (const [resultId, tpl] of Object.entries(CRAFTED_VIAL_TEMPLATES)) {
  if (!tpl.recipe) continue
  const { ingredientA, ingredientB } = tpl.recipe
  if (!ingredientA || !ingredientB) continue
  SEED_RESULT_BY_PAIR.set(pairKey(ingredientA, ingredientB), resultId)
}

/** Identifiant de fiole seed si la paire est connue, sinon `null`. */
export function lookupSeedResultId(vialIdA: string, vialIdB: string): string | null {
  return SEED_RESULT_BY_PAIR.get(pairKey(vialIdA, vialIdB)) ?? null
}

export { pairKey }

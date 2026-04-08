import { MANUAL_RECIPE_PAIRS } from '../data/manualRecipePairs'

function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('|')
}

const SEED_RESULT_BY_PAIR = new Map<string, string>()

for (const { a, b, resultId } of MANUAL_RECIPE_PAIRS) {
  SEED_RESULT_BY_PAIR.set(pairKey(a, b), resultId)
}

/** Identifiant de fiole seed si la paire est connue, sinon `null`. */
export function lookupSeedResultId(vialIdA: string, vialIdB: string): string | null {
  return SEED_RESULT_BY_PAIR.get(pairKey(vialIdA, vialIdB)) ?? null
}

export { pairKey }

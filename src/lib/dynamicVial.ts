import type { NewVialDraft, Vial, VialRarity, VialType } from '../types'
import { buildDynamicElementDraft } from './dynamicElement'
import {
  ELEMENT_AFFINITY_ORDER,
  getIngredientProfile,
} from './ingredientProfile'
import { pairKey } from './recipeMap'

export type { NewVialDraft } from '../types'

const RARITY_ORDER: VialRarity[] = ['common', 'rare', 'epic', 'legendary']

function maxRarity(a: VialRarity, b: VialRarity): VialRarity {
  return RARITY_ORDER[
    Math.max(RARITY_ORDER.indexOf(a), RARITY_ORDER.indexOf(b))
  ] as VialRarity
}

function bumpRarity(r: VialRarity): VialRarity {
  const i = RARITY_ORDER.indexOf(r)
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, i + 1)] as VialRarity
}

function resultType(va: Vial, vb: Vial): VialType {
  void va
  void vb
  return 'element'
}

/** Id canonique : plusieurs paires d’ingrédients peuvent mener à la même fiole. */
export function canonicalDynamicVialId(ingredientA: Vial, ingredientB: Vial): string {
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)
  const ia = ELEMENT_AFFINITY_ORDER.indexOf(pa.affinity)
  const ib = ELEMENT_AFFINITY_ORDER.indexOf(pb.affinity)
  const lo = Math.min(ia, ib)
  const hi = Math.max(ia, ib)
  return `dyn-el-${lo}-${hi}`
}

/**
 * @deprecated Ancien id par paire d’ingrédients — conservé pour références / saves très anciennes.
 */
export function dynamicVialIdForPair(vialIdA: string, vialIdB: string): string {
  return `dyn-${pairKey(vialIdA, vialIdB).replaceAll('|', '-')}`
}

export function isInertUnseededFusion(ingredientA: Vial, ingredientB: Vial): boolean {
  const rt = resultType(ingredientA, ingredientB)
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)

  if (rt === 'element') {
    if (pa.affinity === 'arcane' && pb.affinity === 'arcane') return true
    if (
      /^dyn-el-\d+-\d+$/.test(ingredientA.id) &&
      /^dyn-el-\d+-\d+$/.test(ingredientB.id)
    ) {
      return true
    }
  }

  return false
}

export function buildDynamicVialDraft(
  ingredientA: Vial,
  ingredientB: Vial,
  canonicalId: string,
): NewVialDraft {
  const type = resultType(ingredientA, ingredientB)
  const rarity = bumpRarity(
    maxRarity(ingredientA.rarity, ingredientB.rarity),
  )
  if (type === 'element') {
    return buildDynamicElementDraft(
      ingredientA,
      ingredientB,
      rarity,
      canonicalId,
    )
  }
  return buildDynamicElementDraft(
    ingredientA,
    ingredientB,
    rarity,
    canonicalId,
  )
}

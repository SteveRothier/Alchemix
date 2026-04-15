import type { NewVialDraft, Vial, VialRarity, VialType } from '../types'
import { buildDynamicElementDraft } from './dynamicElement'
import { buildDynamicSpellDraft } from './dynamicSpell'
import {
  canonicalDynamicElementCraftId,
  isCanonicalDynamicElementCraftId,
} from './dynamicElementCraftIds'
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

function isSpellLikeVial(v: Vial): boolean {
  return v.type === 'spell' || v.id.startsWith('sp-') || v.id.startsWith('dyn-sp-')
}

function resultType(va: Vial, vb: Vial): VialType {
  if (isSpellLikeVial(va) || isSpellLikeVial(vb)) return 'spell'
  return 'element'
}

const DYN_SP_ID =
  /^dyn-sp-(air|arcane|earth|fire|light|nature|shadow|water)-(mono|air|arcane|earth|fire|light|nature|shadow|water)$/

function isCanonicalDynamicSpellId(id: string): boolean {
  return DYN_SP_ID.test(id)
}

/** Id canonique pour une fusion sort (stable si on inverse les ingrédients). */
export function canonicalDynamicSpellId(ingredientA: Vial, ingredientB: Vial): string {
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)
  const affA = pa.affinity
  const affB = pb.affinity
  if (affA === affB) {
    return `dyn-sp-${affA}-mono`
  }
  const [lo, hi] = [affA, affB].sort(
    (u, v) =>
      ELEMENT_AFFINITY_ORDER.indexOf(u) - ELEMENT_AFFINITY_ORDER.indexOf(v),
  )
  return `dyn-sp-${lo}-${hi}`
}

/** Id canonique : plusieurs paires d’ingrédients peuvent mener à la même fiole. */
export function canonicalDynamicVialId(ingredientA: Vial, ingredientB: Vial): string {
  if (resultType(ingredientA, ingredientB) === 'spell') {
    return canonicalDynamicSpellId(ingredientA, ingredientB)
  }
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)
  const ia = ELEMENT_AFFINITY_ORDER.indexOf(pa.affinity)
  const ib = ELEMENT_AFFINITY_ORDER.indexOf(pb.affinity)
  const lo = Math.min(ia, ib)
  const hi = Math.max(ia, ib)
  return canonicalDynamicElementCraftId(lo, hi)
}

/**
 * @deprecated Ancien id par paire d’ingrédients — conservé pour références / saves très anciennes.
 */
export function dynamicVialIdForPair(vialIdA: string, vialIdB: string): string {
  return `dyn-${pairKey(vialIdA, vialIdB).replaceAll('|', '-')}`
}

export function isInertUnseededFusion(ingredientA: Vial, ingredientB: Vial): boolean {
  if (
    isCanonicalDynamicSpellId(ingredientA.id) &&
    isCanonicalDynamicSpellId(ingredientB.id)
  ) {
    return true
  }

  const rt = resultType(ingredientA, ingredientB)
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)

  if (rt === 'element') {
    if (pa.affinity === 'arcane' && pb.affinity === 'arcane') return true
    if (
      isCanonicalDynamicElementCraftId(ingredientA.id) &&
      isCanonicalDynamicElementCraftId(ingredientB.id)
    ) {
      return true
    }
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
  return buildDynamicSpellDraft(ingredientA, ingredientB, rarity, canonicalId)
}

import type { NewVialDraft, Vial, VialRarity } from '../types'
import {
  combineIngredientProfiles,
  getIngredientProfile,
  iconForAffinity,
} from './ingredientProfile'
import { simpleElementNameFromCanonicalId } from './simpleElementNames'
import {
  blendSecondaryColors,
  mergeTextures,
  mixHex,
} from './liquidBlend'

export function buildDynamicElementDraft(
  ingredientA: Vial,
  ingredientB: Vial,
  rarity: VialRarity,
  canonicalId: string,
): NewVialDraft {
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)
  const primary = mixHex(
    ingredientA.liquid.primaryColor,
    ingredientB.liquid.primaryColor,
  )
  const secondaryColor = blendSecondaryColors(
    ingredientA.liquid.primaryColor,
    ingredientB.liquid.primaryColor,
    ingredientA.liquid.secondaryColor,
    ingredientB.liquid.secondaryColor,
  )

  const name = simpleElementNameFromCanonicalId(canonicalId)
  const [sx, sy] = [pa.affinity, pb.affinity].sort((u, v) =>
    u.localeCompare(v),
  )
  const description = `Simple essence blending ${sx} and ${sy}.`

  const { dominant } = combineIngredientProfiles(pa, pb)

  return {
    type: 'element',
    name,
    description,
    liquid: {
      primaryColor: primary,
      secondaryColor,
      opacity: Math.min(
        0.98,
        (ingredientA.liquid.opacity + ingredientB.liquid.opacity) / 2,
      ),
      texture: mergeTextures(
        ingredientA.liquid.texture,
        ingredientB.liquid.texture,
      ),
    },
    icon: iconForAffinity(dominant),
    rarity,
    recipe: {
      ingredientA: ingredientA.id,
      ingredientB: ingredientB.id,
    },
  }
}

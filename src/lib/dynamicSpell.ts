import type { NewVialDraft, Vial, VialRarity } from '../types'
import {
  combineIngredientProfiles,
  getIngredientProfile,
  iconForAffinity,
  type ElementAffinity,
} from './ingredientProfile'
import { stablePick } from './dynamicNaming'
import {
  blendSecondaryColors,
  mergeTextures,
  mixHex,
} from './liquidBlend'

const AFFINITY_ANIMATION: Record<ElementAffinity, string> = {
  fire: 'burst',
  water: 'wave',
  earth: 'pulse',
  air: 'pulse',
  shadow: 'pulse',
  light: 'burst',
  nature: 'pulse',
  arcane: 'pulse',
}

const MONO_TITLES: Record<ElementAffinity, readonly string[]> = {
  air: ['Shear Cantrip', 'Draft Hex', 'Gust Rite'],
  arcane: ['Glyph Snippet', 'Odd Cantrip', 'Stray Rite'],
  earth: ['Fault Cantrip', 'Stone Hex', 'Loam Rite'],
  fire: ['Pyre Cantrip', 'Spark Hex', 'Ember Rite'],
  light: ['Gleam Cantrip', 'Bright Hex', 'Halo Rite'],
  nature: ['Tangle Cantrip', 'Wild Hex', 'Thorn Rite'],
  shadow: ['Shroud Cantrip', 'Dim Hex', 'Gloom Rite'],
  water: ['Surge Cantrip', 'Brine Hex', 'Tide Rite'],
}

const DUAL_FIRST: Record<ElementAffinity, readonly string[]> = {
  air: ['Cutting', 'Shearing', 'Lofted'],
  arcane: ['Warped', 'Thin', 'Bent'],
  earth: ['Heavy', 'Settling', 'Faulted'],
  fire: ['Roaring', 'Searing', 'Flaring'],
  light: ['Blinding', 'Soft', 'Rising'],
  nature: ['Creeping', 'Wild', 'Woven'],
  shadow: ['Creeping', 'Deep', 'Hollow'],
  water: ['Rising', 'Brine', 'Flooding'],
}

const DUAL_SECOND: Record<ElementAffinity, readonly string[]> = {
  air: ['Gust', 'Wake', 'Shear'],
  arcane: ['Weft', 'Echo', 'Thread'],
  earth: ['Weight', 'Silt', 'Crag'],
  fire: ['Brand', 'Spark', 'Ash'],
  light: ['Gleam', 'Ray', 'Halo'],
  nature: ['Tangle', 'Bloom', 'Root'],
  shadow: ['Veil', 'Murk', 'Dusk'],
  water: ['Surge', 'Pool', 'Foam'],
}

function englishSpellName(
  dominant: ElementAffinity,
  secondary: ElementAffinity | null,
  canonicalId: string,
): string {
  if (!secondary || secondary === dominant) {
    return stablePick(canonicalId + dominant, MONO_TITLES[dominant])
  }
  const first = stablePick(
    canonicalId + dominant + secondary,
    DUAL_FIRST[dominant],
  )
  const second = stablePick(
    canonicalId + secondary + dominant,
    DUAL_SECOND[secondary],
  )
  return `${first} ${second}`
}

export function buildDynamicSpellDraft(
  ingredientA: Vial,
  ingredientB: Vial,
  rarity: VialRarity,
  canonicalId: string,
): NewVialDraft {
  const pa = getIngredientProfile(ingredientA)
  const pb = getIngredientProfile(ingredientB)
  const { dominant, secondary } = combineIngredientProfiles(pa, pb)
  const sec =
    secondary && secondary !== dominant ? secondary : null

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
  const effectColor = secondaryColor ?? primary

  const name = englishSpellName(dominant, sec, canonicalId)
  const description = sec
    ? `Improvised spell: ${dominant} overtone with ${sec} undertone.`
    : `Improvised spell anchored in ${dominant}.`

  return {
    type: 'spell',
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
    effect: {
      animation: AFFINITY_ANIMATION[dominant],
      color: effectColor,
    },
  }
}

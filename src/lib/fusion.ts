import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import type { Vial } from '../types'
import { buildDynamicVialDraft, dynamicVialIdForPair } from './dynamicVial'
import { lookupSeedResultId } from './recipeMap'

function buildDynamicOutcome(
  a: Vial,
  b: Vial,
  vialsById: Record<string, Vial>,
): { vial: Vial; wasNew: boolean } {
  const id = dynamicVialIdForPair(a.id, b.id)
  const existing = vialsById[id]
  if (existing) return { vial: existing, wasNew: false }
  const draft = buildDynamicVialDraft(a, b)
  const vial: Vial = {
    ...draft,
    id,
    discoveredAt: new Date().toISOString(),
  }
  return { vial, wasNew: true }
}

/** Détermine la fiole produite par la fusion (seed ou dynamique). */
export function resolveFusionProduct(
  ingredientA: Vial,
  ingredientB: Vial,
  vialsById: Record<string, Vial>,
): { vial: Vial; wasNew: boolean } {
  const seedId = lookupSeedResultId(ingredientA.id, ingredientB.id)
  if (seedId) {
    const existing = vialsById[seedId]
    if (existing) return { vial: existing, wasNew: false }
    const template = CRAFTED_VIAL_TEMPLATES[seedId]
    if (!template) {
      return buildDynamicOutcome(ingredientA, ingredientB, vialsById)
    }
    const vial: Vial = {
      ...template,
      discoveredAt: new Date().toISOString(),
    }
    return { vial, wasNew: true }
  }
  return buildDynamicOutcome(ingredientA, ingredientB, vialsById)
}

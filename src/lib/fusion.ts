import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import type { Vial } from '../types'
import {
  buildDynamicVialDraft,
  canonicalDynamicVialId,
  isInertUnseededFusion,
} from './dynamicVial'
import { lookupSeedResultId } from './recipeMap'

export type FusionResolution =
  | { ok: true; vial: Vial; wasNew: boolean }
  | { ok: false; reason: 'inert' }

function buildDynamicOutcome(
  a: Vial,
  b: Vial,
  vialsById: Record<string, Vial>,
): FusionResolution {
  if (isInertUnseededFusion(a, b)) {
    return { ok: false, reason: 'inert' }
  }
  const id = canonicalDynamicVialId(a, b)
  const existing = vialsById[id]
  if (existing) return { ok: true, vial: existing, wasNew: false }
  const draft = buildDynamicVialDraft(a, b, id)
  const vial: Vial = {
    ...draft,
    id,
    discoveredAt: new Date().toISOString(),
    origin: 'dynamic',
  }
  return { ok: true, vial, wasNew: true }
}

/** Détermine la fiole produite par la fusion (seed ou dynamique). */
export function resolveFusionProduct(
  ingredientA: Vial,
  ingredientB: Vial,
  vialsById: Record<string, Vial>,
): FusionResolution {
  const seedId = lookupSeedResultId(ingredientA.id, ingredientB.id)
  if (seedId) {
    const existing = vialsById[seedId]
    if (existing) return { ok: true, vial: existing, wasNew: false }
    const template = CRAFTED_VIAL_TEMPLATES[seedId]
    if (!template) {
      return buildDynamicOutcome(ingredientA, ingredientB, vialsById)
    }
    const vial: Vial = {
      ...template,
      discoveredAt: new Date().toISOString(),
    }
    return { ok: true, vial, wasNew: true }
  }
  return buildDynamicOutcome(ingredientA, ingredientB, vialsById)
}

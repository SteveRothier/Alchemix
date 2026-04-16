import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import type { Vial } from '../types'
import { lookupSeedResultId } from './recipeMap'

const DEFAULT_LIQUID: Vial['liquid'] = {
  primaryColor: '#ffffff',
  opacity: 0.85,
  texture: 'liquid',
}

export type FusionResolution =
  | { ok: true; vial: Vial; wasNew: boolean }
  | { ok: false; reason: 'inert' }

/** Fusion uniquement si la paire est enregistrée dans le catalogue (`recipe` → recipeMap). */
export function resolveFusionProduct(
  ingredientA: Vial,
  ingredientB: Vial,
  vialsById: Record<string, Vial>,
): FusionResolution {
  const seedId = lookupSeedResultId(ingredientA.id, ingredientB.id)
  if (!seedId) {
    return { ok: false, reason: 'inert' }
  }
  const existing = vialsById[seedId]
  if (existing) return { ok: true, vial: existing, wasNew: false }
  const template = CRAFTED_VIAL_TEMPLATES[seedId]
  if (!template) {
    return { ok: false, reason: 'inert' }
  }
  const liquid = template.liquid ?? DEFAULT_LIQUID
  const vial: Vial = {
    ...template,
    liquid,
    description: inferSeedDescription(template.name),
    icon: 'rune',
    rarity: 'common',
    discoveredAt: new Date().toISOString(),
  }
  return { ok: true, vial, wasNew: true }
}

function inferSeedDescription(name: string): string {
  return `${name} essence.`
}

import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { getCreatureIdFromOfferedElement } from '../data/creatureOfferMap'
import type { Vial } from '../types'

const DEFAULT_LIQUID: Vial['liquid'] = {
  primaryColor: '#ffffff',
  opacity: 0.85,
  texture: 'liquid',
}

export type CreatureOfferResult =
  | { ok: false; reason: 'not_element' | 'no_creature' | 'already_owned' }
  | { ok: true; creature: Vial }

/**
 * Offre un élément au personnage : peut débloquer une créature trophée.
 */
export function resolveCreatureFromOffering(
  offeredVial: Vial | undefined,
  vialsById: Record<string, Vial>,
): CreatureOfferResult {
  if (!offeredVial || offeredVial.type !== 'element') {
    return { ok: false, reason: 'not_element' }
  }

  const creatureId = getCreatureIdFromOfferedElement(offeredVial.id)
  if (!creatureId) {
    return { ok: false, reason: 'no_creature' }
  }

  const template = CRAFTED_VIAL_TEMPLATES[creatureId]
  if (!template || template.type !== 'creature') {
    return { ok: false, reason: 'no_creature' }
  }

  const existing = vialsById[creatureId]
  if (existing) {
    return { ok: false, reason: 'already_owned' }
  }

  const liquid = template.liquid ?? DEFAULT_LIQUID
  const creature: Vial = {
    ...template,
    liquid,
    description: `${template.name} trophy.`,
    icon: 'rune',
    rarity: 'common',
    discoveredAt: new Date().toISOString(),
  }
  return { ok: true, creature }
}

import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { getCreatureIdFromOfferedElement } from '../data/spellDrinkCreatures'
import type { Vial } from '../types'

export type DrinkSpellResult =
  | { ok: false; reason: 'not_element' | 'no_creature' | 'already_owned' }
  | { ok: true; creature: Vial }

/**
 * Offers an element to the character: may unlock a creature trophy.
 */
export function resolveDrinkSpell(
  offeredVial: Vial | undefined,
  vialsById: Record<string, Vial>,
): DrinkSpellResult {
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

  const creature: Vial = {
    ...template,
    rarity: template.rarity ?? 'common',
    discoveredAt: new Date().toISOString(),
  }
  return { ok: true, creature }
}

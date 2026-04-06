import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { getCreatureIdFromDrunkSpell } from '../data/spellDrinkCreatures'
import type { Vial } from '../types'

export type DrinkSpellResult =
  | { ok: false; reason: 'not_spell' | 'no_creature' | 'already_owned' }
  | { ok: true; creature: Vial }

/**
 * Fait « boire » un sort au personnage : compteur d’usage + éventuelle créature.
 */
export function resolveDrinkSpell(
  spellVial: Vial | undefined,
  vialsById: Record<string, Vial>,
): DrinkSpellResult {
  if (!spellVial || spellVial.type !== 'spell') {
    return { ok: false, reason: 'not_spell' }
  }

  const creatureId = getCreatureIdFromDrunkSpell(spellVial.id)
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
    discoveredAt: new Date().toISOString(),
  }
  return { ok: true, creature }
}

/**
 * Element ids that can unlock a creature trophy when offered.
 * Absence from this table = no trophy unlock.
 */
export const OFFERING_ID_TO_CREATURE_ID: Partial<Record<string, string>> = {
  'sp-fireball': 'creature-infernal-beast',
  'sp-inferno-wave': 'creature-infernal-beast',
  'sp-icy-wind': 'creature-frost-beast',
  'sp-holy-light': 'creature-celestial-beast',
  'sp-dark-pulse': 'creature-shadow-beast',
  'sp-nature-wrath': 'creature-beast',
  'sp-stone-wall': 'creature-beast',
  'sp-swamp-curse': 'creature-toxic-beast',
  'sp-chain-lightning': 'creature-storm-beast',
  'sp-infernal-cyclone': 'creature-infernal-beast',
  'sp-void-rift': 'creature-shadow-beast',
  'sp-plague-touch': 'creature-toxic-beast',
}

export function getCreatureIdFromOfferedElement(vialId: string): string | null {
  return OFFERING_ID_TO_CREATURE_ID[vialId] ?? null
}

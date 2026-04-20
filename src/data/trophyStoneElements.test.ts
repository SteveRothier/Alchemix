import { describe, expect, it } from 'vitest'
import { CRAFTED_VIAL_TEMPLATES } from './craftedVials'
import { TROPHY_STONE_ELEMENT_IDS } from './trophyStoneElements'

describe('TROPHY_STONE_ELEMENT_IDS', () => {
  it('référence uniquement des éléments présents dans craftedVials', () => {
    for (const id of TROPHY_STONE_ELEMENT_IDS) {
      const t = CRAFTED_VIAL_TEMPLATES[id]
      expect(t, `id manquant: ${id}`).toBeDefined()
      expect(t?.type, id).toBe('element')
    }
  })
})

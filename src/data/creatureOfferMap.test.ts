import { describe, expect, it } from 'vitest'
import { getCreatureIdFromOfferedElement } from './creatureOfferMap'

describe('getCreatureIdFromOfferedElement', () => {
  it('débloque le golem en offrant craft-stone', () => {
    expect(getCreatureIdFromOfferedElement('craft-stone')).toBe('creature-golem')
  })

  it("garde l’alias sp-stone-wall → golem", () => {
    expect(getCreatureIdFromOfferedElement('sp-stone-wall')).toBe('creature-golem')
  })
})

import { describe, expect, it } from 'vitest'
import { getCreatureIdFromOfferedElement } from './spellDrinkCreatures'

describe('getCreatureIdFromOfferedElement', () => {
  it('unlocks golem when offering craft-stone', () => {
    expect(getCreatureIdFromOfferedElement('craft-stone')).toBe('creature-golem')
  })

  it('keeps legacy spell alias for stone wall', () => {
    expect(getCreatureIdFromOfferedElement('sp-stone-wall')).toBe('creature-golem')
  })
})

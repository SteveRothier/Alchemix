import { describe, expect, it } from 'vitest'
import {
  SIMPLE_ELEMENT_BY_INDEX_PAIR,
  simpleElementNameFromCanonicalId,
} from './simpleElementNames'

describe('simpleElementNames', () => {
  it('chaque entrée est un seul mot (sans espace)', () => {
    for (const name of Object.values(SIMPLE_ELEMENT_BY_INDEX_PAIR)) {
      expect(name).not.toMatch(/\s/)
    }
  })

  it('résout les exemples canoniques', () => {
    expect(simpleElementNameFromCanonicalId('dyn-el-2-2')).toBe('Loam')
    expect(simpleElementNameFromCanonicalId('dyn-el-2-6')).toBe('Obsidian')
    expect(simpleElementNameFromCanonicalId('dyn-el-0-1')).toBe('Space')
  })
})

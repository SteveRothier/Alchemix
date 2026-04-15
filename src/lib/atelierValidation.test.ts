import { describe, expect, it } from 'vitest'
import {
  hasHalfFilledPair,
  hasPairConflict,
  hasSoloConflict,
} from './atelierValidation'

describe('hasHalfFilledPair', () => {
  it('returns true when only one side is filled', () => {
    expect(hasHalfFilledPair('a', '')).toBe(true)
    expect(hasHalfFilledPair('', 'b')).toBe(true)
  })

  it('returns false when both empty or both filled', () => {
    expect(hasHalfFilledPair('', '')).toBe(false)
    expect(hasHalfFilledPair('a', 'b')).toBe(false)
  })
})

describe('hasPairConflict', () => {
  const rows = [
    { clientId: 1, a: 'x', b: 'y', resultId: 'r1' },
    { clientId: 2, a: '', b: '', resultId: 'creature-z' },
  ]

  it('detects duplicate ingredient pair regardless of order', () => {
    expect(hasPairConflict(rows, 'y', 'x', 'r2')).toBe(true)
    expect(hasPairConflict(rows, 'x', 'y', 'r2')).toBe(true)
  })

  it('detects duplicate empty-ingredient row by result only', () => {
    expect(hasPairConflict(rows, '', '', 'creature-z')).toBe(true)
    expect(hasPairConflict(rows, '', '', 'other')).toBe(false)
  })

  it('ignores the row with matching clientId when excluding', () => {
    expect(hasPairConflict(rows, 'x', 'y', 'r1', 1)).toBe(false)
    expect(hasPairConflict(rows, '', '', 'creature-z', 2)).toBe(false)
  })
})

describe('hasSoloConflict', () => {
  const rows = [
    { clientId: 1, id: 'el-foo' },
    { clientId: 2, id: 'el-bar' },
  ]

  it('detects duplicate id', () => {
    expect(hasSoloConflict(rows, 'el-foo')).toBe(true)
  })

  it('respects excludeClientId', () => {
    expect(hasSoloConflict(rows, 'el-foo', 1)).toBe(false)
  })
})

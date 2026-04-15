import { describe, expect, it } from 'vitest'
import type { Vial } from '../types'
import {
  applyLegacyVialIdRename,
  migrateElNatureToGrassInStore,
  reconcileStarterVialsWithDefinitions,
  resolveLabVialDisplayName,
} from './legacyVialIdRenames'

describe('resolveLabVialDisplayName', () => {
  it('uses starter definition for id even when persisted name is stale', () => {
    expect(
      resolveLabVialDisplayName({
        id: 'el-grass',
        name: 'Nature',
      } as Vial),
    ).toBe('Grass')
  })

  it('resolves legacy el-nature id to Grass', () => {
    expect(
      resolveLabVialDisplayName({
        id: 'el-nature',
        name: 'Nature',
      } as Vial),
    ).toBe('Grass')
  })
})

describe('applyLegacyVialIdRename', () => {
  it('maps el-nature to el-grass', () => {
    expect(applyLegacyVialIdRename('el-nature')).toBe('el-grass')
  })

  it('leaves other ids unchanged', () => {
    expect(applyLegacyVialIdRename('el-water')).toBe('el-water')
    expect(applyLegacyVialIdRename('craft-grove')).toBe('craft-grove')
  })
})

describe('migrateElNatureToGrassInStore', () => {
  it('rekeys vials and offering counts', () => {
    const iso = '2020-01-01T00:00:00.000Z'
    const vials: Record<string, Vial> = {
      'el-nature': {
        id: 'el-nature',
        type: 'element',
        name: 'Nature',
        description: 'x',
        liquid: {
          primaryColor: '#000',
          opacity: 1,
          texture: 'liquid',
        },
        icon: 'leaf',
        discoveredAt: iso,
        rarity: 'common',
      },
    }
    const offeringUseCount: Record<string, number> = { 'el-nature': 2 }
    migrateElNatureToGrassInStore(vials, offeringUseCount)

    expect(vials['el-nature']).toBeUndefined()
    expect(vials['el-grass']?.id).toBe('el-grass')
    expect(vials['el-grass']?.name).toBe('Grass')
    expect(vials['el-grass']?.discoveredAt).toBe(iso)
    expect(offeringUseCount['el-nature']).toBeUndefined()
    expect(offeringUseCount['el-grass']).toBe(2)
  })
})

describe('reconcileStarterVialsWithDefinitions', () => {
  it('updates stale starter name from definitions, keeps discoveredAt and liquid', () => {
    const iso = '2019-06-01T12:00:00.000Z'
    const customLiquid = {
      primaryColor: '#111111',
      opacity: 0.5,
      texture: 'liquid' as const,
    }
    const vials: Record<string, Vial> = {
      'el-grass': {
        id: 'el-grass',
        type: 'element',
        name: 'Nature',
        description: 'old',
        liquid: customLiquid,
        icon: 'rune',
        discoveredAt: iso,
        rarity: 'common',
      },
    }
    reconcileStarterVialsWithDefinitions(vials)
    expect(vials['el-grass']?.name).toBe('Grass')
    expect(vials['el-grass']?.discoveredAt).toBe(iso)
    expect(vials['el-grass']?.liquid).toEqual(customLiquid)
  })
})

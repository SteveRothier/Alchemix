import { describe, expect, it } from 'vitest'
import type { Vial } from '../types'
import { canonicalDynamicVialId } from './dynamicVial'
import { resolveFusionProduct } from './fusion'

function stubVial(
  partial: Partial<Vial> & Pick<Vial, 'id' | 'type' | 'name'>,
): Vial {
  return {
    description: '',
    liquid: {
      primaryColor: '#e85d04',
      secondaryColor: '#219ebc',
      opacity: 0.85,
      texture: 'liquid',
    },
    icon: 'rune',
    rarity: 'common',
    discoveredAt: '2020-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('resolveFusionProduct (dynamique)', () => {
  it('produit un élément canonique hors seed (ids partagés par plusieurs paires)', () => {
    const a = stubVial({
      id: 'craft-wildspark',
      type: 'element',
      name: 'Wildspark',
      liquid: { primaryColor: '#52b788', opacity: 0.88, texture: 'spark' },
    })
    const b = stubVial({
      id: 'craft-spindrift',
      type: 'element',
      name: 'Spindrift',
      liquid: { primaryColor: '#8ecae6', opacity: 0.62, texture: 'wave' },
    })
    const outcome = resolveFusionProduct(a, b, {})
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.wasNew).toBe(true)
    expect(outcome.vial.type).toBe('element')
    expect(outcome.vial.origin).toBe('dynamic')
    expect(outcome.vial.id).toBe(canonicalDynamicVialId(a, b))
    expect(outcome.vial.id).toMatch(/^dyn-el-\d+-\d+$/)
    expect(outcome.vial.effect).toBeUndefined()
    expect(outcome.vial.name).toBe('Lagoon')
    expect(outcome.vial.name).not.toMatch(/\s/)
  })

  it('deux paires différentes peuvent donner la même fiole (même id)', () => {
    const soil = stubVial({
      id: 'craft-soil',
      type: 'element',
      name: 'Soil',
      liquid: { primaryColor: '#6b4423', opacity: 0.9, texture: 'liquid' },
    })
    const swamp = stubVial({
      id: 'craft-swamp',
      type: 'element',
      name: 'Swamp',
      liquid: { primaryColor: '#386641', opacity: 0.88, texture: 'bubbles' },
    })
    const bloom = stubVial({
      id: 'craft-bloom',
      type: 'element',
      name: 'Bloom',
      liquid: { primaryColor: '#95d5b2', opacity: 0.85, texture: 'bubbles' },
    })
    const id1 = canonicalDynamicVialId(soil, swamp)
    const id2 = canonicalDynamicVialId(soil, bloom)
    expect(id1).toBe(id2)
    expect(id1).toBe('dyn-el-5-5')
  })

  it('sort dynamique avec effet (élément + sort)', () => {
    const el = stubVial({
      id: 'el-water',
      type: 'element',
      name: 'Water',
      liquid: { primaryColor: '#219ebc', opacity: 0.88, texture: 'wave' },
    })
    const sp = stubVial({
      id: 'sp-fireball',
      type: 'spell',
      name: 'Fireball',
      rarity: 'rare',
      liquid: { primaryColor: '#ff4800', opacity: 0.94, texture: 'spark' },
      effect: { animation: 'burst', color: '#ff0000' },
    })
    const outcome = resolveFusionProduct(el, sp, {})
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.vial.type).toBe('spell')
    expect(outcome.vial.origin).toBe('dynamic')
    expect(outcome.vial.effect).toBeDefined()
    expect(outcome.vial.effect?.animation).toBeTruthy()
    expect(outcome.vial.effect?.color).toMatch(/^#/)
    expect(outcome.vial.id).toMatch(/^dyn-sp-/)
  })

  it('deux sorts seed → sort dynamique', () => {
    const s1 = stubVial({
      id: 'sp-fireball',
      type: 'spell',
      name: 'Fireball',
      liquid: { primaryColor: '#111', opacity: 0.9, texture: 'smoke' },
      effect: { animation: 'burst', color: '#f00' },
    })
    const s2 = stubVial({
      id: 'sp-holy-light',
      type: 'spell',
      name: 'Holy Light',
      liquid: { primaryColor: '#222', opacity: 0.9, texture: 'smoke' },
      effect: { animation: 'burst', color: '#ff0' },
    })
    const outcome = resolveFusionProduct(s1, s2, {})
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.vial.type).toBe('spell')
    expect(outcome.vial.effect).toBeDefined()
  })

  it('ordre des ingrédients : même id canonique', () => {
    const a = stubVial({
      id: 'craft-wildspark',
      type: 'element',
      name: 'W',
      liquid: { primaryColor: '#52b788', opacity: 0.88, texture: 'spark' },
    })
    const b = stubVial({
      id: 'craft-spindrift',
      type: 'element',
      name: 'S',
      liquid: { primaryColor: '#8ecae6', opacity: 0.62, texture: 'wave' },
    })
    const o1 = resolveFusionProduct(a, b, {})
    const o2 = resolveFusionProduct(b, a, {})
    expect(o1.ok && o2.ok).toBe(true)
    if (!o1.ok || !o2.ok) return
    expect(o1.vial.id).toBe(o2.vial.id)
  })

  it('réutilise la fiole existante dans vialsById', () => {
    const a = stubVial({
      id: 'craft-wildspark',
      type: 'element',
      name: 'W',
      liquid: { primaryColor: '#52b788', opacity: 0.88, texture: 'spark' },
    })
    const b = stubVial({
      id: 'craft-spindrift',
      type: 'element',
      name: 'S',
      liquid: { primaryColor: '#8ecae6', opacity: 0.62, texture: 'wave' },
    })
    const first = resolveFusionProduct(a, b, {})
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const existing = { ...first.vial }
    const second = resolveFusionProduct(a, b, { [existing.id]: existing })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.wasNew).toBe(false)
    expect(second.vial).toBe(existing)
  })

  it('fusion inerte : arcane + arcane (éléments)', () => {
    const a = stubVial({
      id: 'z-unk-a',
      type: 'element',
      name: 'X',
      liquid: { primaryColor: '#999', opacity: 0.5, texture: 'liquid' },
    })
    const b = stubVial({
      id: 'z-unk-b',
      type: 'element',
      name: 'Y',
      liquid: { primaryColor: '#888', opacity: 0.5, texture: 'liquid' },
    })
    const outcome = resolveFusionProduct(a, b, {})
    expect(outcome.ok).toBe(false)
    if (outcome.ok === false) {
      expect(outcome.reason).toBe('inert')
    }
  })

  it('fusion inerte : deux amalgames dyn-el', () => {
    const a = stubVial({
      id: 'dyn-el-3-7',
      type: 'element',
      name: 'Amalgam',
      liquid: { primaryColor: '#999', opacity: 0.5, texture: 'liquid' },
    })
    const b = stubVial({
      id: 'dyn-el-1-4',
      type: 'element',
      name: 'Amalgam2',
      liquid: { primaryColor: '#888', opacity: 0.5, texture: 'liquid' },
    })
    const outcome = resolveFusionProduct(a, b, {})
    expect(outcome.ok).toBe(false)
  })

  it('fusion inerte : deux sorts dyn-sp', () => {
    const a = stubVial({
      id: 'dyn-sp-fire-mono',
      type: 'spell',
      name: 'S1',
      liquid: { primaryColor: '#f00', opacity: 0.9, texture: 'spark' },
      effect: { animation: 'burst', color: '#f00' },
    })
    const b = stubVial({
      id: 'dyn-sp-water-mono',
      type: 'spell',
      name: 'S2',
      liquid: { primaryColor: '#00f', opacity: 0.9, texture: 'wave' },
      effect: { animation: 'wave', color: '#00f' },
    })
    const outcome = resolveFusionProduct(a, b, {})
    expect(outcome.ok).toBe(false)
  })
})

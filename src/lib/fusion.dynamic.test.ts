import { describe, expect, it } from 'vitest'
import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import type { Vial } from '../types'
import { resolveFusionProduct } from './fusion'
import { lookupSeedResultId } from './recipeMap'

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

describe('resolveFusionProduct (catalogue / registre)', () => {
  it('Vapor : eau + lave depuis le catalogue', () => {
    const tpl = CRAFTED_VIAL_TEMPLATES['craft-vapor']
    expect(tpl?.recipe).toEqual({
      ingredientA: 'el-water',
      ingredientB: 'craft-lava',
    })
    const elWater = stubVial({
      id: 'el-water',
      type: 'element',
      name: 'Water',
      liquid: { primaryColor: '#219ebc', opacity: 0.88, texture: 'wave' },
    })
    const lavaTpl = CRAFTED_VIAL_TEMPLATES['craft-lava']
    const lava = stubVial({
      id: 'craft-lava',
      type: 'element',
      name: lavaTpl?.name ?? 'Lava',
      liquid: lavaTpl?.liquid ?? {
        primaryColor: '#e85d04',
        opacity: 0.9,
        texture: 'liquid',
      },
    })
    expect(lookupSeedResultId('el-water', 'craft-lava')).toBe('craft-vapor')
    const outcome = resolveFusionProduct(elWater, lava, {})
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.vial.id).toBe('craft-vapor')
  })

  it('paire sans recette enregistrée → inerte', () => {
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
    expect(lookupSeedResultId(a.id, b.id)).toBeNull()
    const outcome = resolveFusionProduct(a, b, {})
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('inert')
  })

  it('élément + sort sans recette seed → inerte', () => {
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
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('inert')
  })

  it('deux sorts sans recette seed → inerte', () => {
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
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('inert')
  })

  it('ordre des ingrédients : même résultat si recette symétrique', () => {
    const elWater = stubVial({
      id: 'el-water',
      type: 'element',
      name: 'Water',
      liquid: { primaryColor: '#219ebc', opacity: 0.88, texture: 'wave' },
    })
    const lavaTpl = CRAFTED_VIAL_TEMPLATES['craft-lava']
    const lava = stubVial({
      id: 'craft-lava',
      type: 'element',
      name: lavaTpl?.name ?? 'Lava',
      liquid: lavaTpl?.liquid ?? {
        primaryColor: '#e85d04',
        opacity: 0.9,
        texture: 'liquid',
      },
    })
    const o1 = resolveFusionProduct(elWater, lava, {})
    const o2 = resolveFusionProduct(lava, elWater, {})
    expect(o1.ok && o2.ok).toBe(true)
    if (!o1.ok || !o2.ok) return
    expect(o1.vial.id).toBe(o2.vial.id)
  })

  it('réutilise la fiole existante dans vialsById', () => {
    const elWater = stubVial({
      id: 'el-water',
      type: 'element',
      name: 'Water',
      liquid: { primaryColor: '#219ebc', opacity: 0.88, texture: 'wave' },
    })
    const lavaTpl = CRAFTED_VIAL_TEMPLATES['craft-lava']
    const lava = stubVial({
      id: 'craft-lava',
      type: 'element',
      name: lavaTpl?.name ?? 'Lava',
      liquid: lavaTpl?.liquid ?? {
        primaryColor: '#e85d04',
        opacity: 0.9,
        texture: 'liquid',
      },
    })
    const vaporTpl = CRAFTED_VIAL_TEMPLATES['craft-vapor']
    const existing: Vial = {
      id: 'craft-vapor',
      type: 'element',
      name: vaporTpl.name,
      description: 'already owned',
      liquid: vaporTpl.liquid ?? {
        primaryColor: '#fff',
        opacity: 0.85,
        texture: 'liquid',
      },
      icon: 'rune',
      rarity: 'common',
      discoveredAt: '2020-01-01T00:00:00.000Z',
      ...(vaporTpl.recipe ? { recipe: vaporTpl.recipe } : {}),
    }
    const second = resolveFusionProduct(elWater, lava, { 'craft-vapor': existing })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.wasNew).toBe(false)
    expect(second.vial).toBe(existing)
  })

  it('fusion inerte : ids éléments inconnus', () => {
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

  it('fusion inerte : deux crafts sans recette seed pour cette paire', () => {
    const a = stubVial({
      id: 'craft-vapor',
      type: 'element',
      name: 'Amalgam',
      liquid: { primaryColor: '#999', opacity: 0.5, texture: 'liquid' },
    })
    const b = stubVial({
      id: 'craft-prism',
      type: 'element',
      name: 'Amalgam2',
      liquid: { primaryColor: '#888', opacity: 0.5, texture: 'liquid' },
    })
    const outcome = resolveFusionProduct(a, b, {})
    expect(outcome.ok).toBe(false)
  })

  it('fusion inerte : ids dyn-sp (legacy) sans recette', () => {
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

import { describe, expect, it } from 'vitest'
import { CRAFTED_VIAL_TEMPLATES } from '../data/craftedVials'
import { TROPHY_CATEGORY_DEFS } from './trophyCategories'

describe('trophyCategories keywords', () => {
  it('chaque mot-clé correspond à au moins un élément crafté (id ou nom)', () => {
    const els = Object.values(CRAFTED_VIAL_TEMPLATES).filter((v) => v.type === 'element')
    const haystacks = els.map((v) => `${v.id} ${v.name}`.toLowerCase())
    const keys = [...new Set(TROPHY_CATEGORY_DEFS.flatMap((d) => d.keywords))].sort()
    const missing: string[] = []
    for (const k of keys) {
      if (!haystacks.some((h) => h.includes(k))) missing.push(k)
    }
    expect(missing, `Mots-clés sans élément: ${missing.join(', ')}`).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { buildCraftedVialsTs } from './buildCraftedVialsSource'

describe('buildCraftedVialsTs', () => {
  it('keeps creature entries minimal in output', () => {
    const ts = buildCraftedVialsTs(
      [{ a: 'el-water', b: 'el-water', resultId: 'creature-otter' }],
      [],
      {},
    )

    expect(ts).toContain("'creature-otter': {")
    expect(ts).toContain('recipe: { ingredientA: "el-water", ingredientB: "el-water" },')
    expect(ts).not.toContain('rarity:')
    expect(ts).not.toContain('description:')
    expect(ts).not.toContain('icon:')
  })

  it('keeps multiple combinations for same result', () => {
    const ts = buildCraftedVialsTs(
      [
        { a: 'heat', b: 'ice', resultId: 'craft-steam' },
        { a: 'el-water', b: 'el-fire', resultId: 'craft-steam' },
      ],
      [],
      {},
    )

    expect(ts).toContain("'craft-steam': {")
    expect(ts).toContain('recipes: [')
    expect(ts).toContain('{ ingredientA: "heat", ingredientB: "ice" },')
    expect(ts).toContain('{ ingredientA: "el-water", ingredientB: "el-fire" },')
  })
})

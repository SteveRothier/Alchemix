import {
  CRAFTED_VIAL_TEMPLATES,
  type CraftedVialTemplate,
} from '../data/craftedVials'
import { inferLabelFromRef } from './inferVialLabel'
import type { LiquidTexture, Vial, VialType } from '../types'

export type CraftPairInput = { a: string; b: string; resultId: string }
export type CraftSoloInput = { id: string }
export type VisualOverrideInput = {
  primaryColor: string
  secondaryColor: string
  opacity: number
  texture: LiquidTexture
}

function defaultLiquid(): Vial['liquid'] {
  return {
    primaryColor: '#ffffff',
    opacity: 0.85,
    texture: 'liquid',
  }
}

function cloneTemplate(t: CraftedVialTemplate): CraftedVialTemplate {
  return {
    ...t,
    ...(t.liquid ? { liquid: { ...t.liquid } } : {}),
    recipe: t.recipe ? { ...t.recipe } : undefined,
    recipes: t.recipes?.map((r) => ({ ...r })),
  }
}

function dedupeRecipes(
  rows: Array<{ ingredientA: string; ingredientB: string }>,
): Array<{ ingredientA: string; ingredientB: string }> {
  const out: Array<{ ingredientA: string; ingredientB: string }> = []
  const seen = new Set<string>()
  for (const row of rows) {
    const a = row.ingredientA.trim()
    const b = row.ingredientB.trim()
    if (!a || !b) continue
    const k = [a, b].sort().join('|')
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ ingredientA: a, ingredientB: b })
  }
  return out
}

export function buildCraftedVialsTs(
  pairs: CraftPairInput[],
  soloRows: CraftSoloInput[],
  visualOverrides: Record<string, VisualOverrideInput>,
): string {
  const out = new Map<string, CraftedVialTemplate>()
  for (const [id, t] of Object.entries(CRAFTED_VIAL_TEMPLATES)) {
    out.set(id, cloneTemplate(t))
  }

  const pairIds = new Set<string>()
  const ingredientIds = new Set<string>()
  const recipesByResultId = new Map<string, Array<{ ingredientA: string; ingredientB: string }>>()
  for (const p of pairs) {
    const id = p.resultId.trim()
    if (!id) continue
    pairIds.add(id)
    const a = p.a.trim()
    const b = p.b.trim()
    if (a) ingredientIds.add(a)
    if (b) ingredientIds.add(b)
    const existing = out.get(id)
    const lower = id.toLowerCase()
    const type: VialType = lower.startsWith('creature-') ? 'creature' : 'element'
    const next: CraftedVialTemplate = existing
      ? cloneTemplate(existing)
      : {
          id,
          type,
          name: inferLabelFromRef(id),
          liquid: defaultLiquid(),
        }
    const prev = recipesByResultId.get(id) ?? []
    if (a && b) recipesByResultId.set(id, [...prev, { ingredientA: a, ingredientB: b }])
    else recipesByResultId.set(id, prev)
    delete next.recipe
    delete next.recipes
    out.set(id, next)
  }

  for (const [id, rows] of recipesByResultId.entries()) {
    const next = out.get(id)
    if (!next) continue
    const recipes = dedupeRecipes(rows)
    if (recipes.length === 0) {
      delete next.recipe
      delete next.recipes
    } else if (recipes.length === 1) {
      next.recipe = recipes[0]
      delete next.recipes
    } else {
      next.recipes = recipes
      delete next.recipe
    }
    out.set(id, next)
  }

  const soloIds = new Set<string>()
  for (const s of soloRows) {
    const id = s.id.trim()
    if (!id) continue
    soloIds.add(id)
    const existing = out.get(id)
    const next: CraftedVialTemplate = existing
      ? cloneTemplate(existing)
      : {
          id,
          type: 'element',
          name: inferLabelFromRef(id),
          liquid: defaultLiquid(),
        }
    delete next.recipe
    delete next.recipes
    out.set(id, next)
  }

  for (const [id, ov] of Object.entries(visualOverrides)) {
    const existing = out.get(id)
    const lower = id.toLowerCase()
    const type: VialType = lower.startsWith('creature-') ? 'creature' : 'element'
    const next: CraftedVialTemplate = existing
      ? cloneTemplate(existing)
      : {
          id,
          type,
          name: inferLabelFromRef(id),
          liquid: defaultLiquid(),
        }
    next.liquid = {
      primaryColor: ov.primaryColor.trim() || '#ffffff',
      ...(ov.secondaryColor.trim() ? { secondaryColor: ov.secondaryColor.trim() } : {}),
      opacity: Math.min(1, Math.max(0, Number(ov.opacity) || 0.85)),
      texture: ov.texture,
    }
    out.set(id, next)
  }

  const activeIds = new Set<string>([
    ...pairIds,
    ...soloIds,
    ...ingredientIds,
    ...Object.keys(visualOverrides),
  ])
  for (const id of out.keys()) {
    if (!activeIds.has(id)) out.delete(id)
  }

  const sorted = [...out.entries()].sort(([a], [b]) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  )

  const q = (v: string) => JSON.stringify(v)
  const lines: string[] = [
    "import type { Vial } from '../types'",
    '',
    'export type CraftedVialTemplate = Omit<',
    '  Vial,',
    "  'discoveredAt' | 'rarity' | 'description' | 'icon' | 'liquid'",
    '> & {',
    "  liquid?: Vial['liquid']",
    "  recipes?: Array<{ ingredientA: string; ingredientB: string }>",
    '}',
    '',
    '/** Fioles du catalogue seed (sans `discoveredAt`). */',
    'export const CRAFTED_VIAL_TEMPLATES: Record<string, CraftedVialTemplate> = {',
  ]

  for (const [id, t] of sorted) {
    lines.push(`  '${id}': {`)
    lines.push(`    id: ${q(t.id)},`)
    lines.push(`    type: ${q(t.type)},`)
    lines.push(`    name: ${q(t.name)},`)
    if (t.type !== 'creature') {
      const liquid = t.liquid ?? defaultLiquid()
      lines.push('    liquid: {')
      lines.push(`      primaryColor: ${q(liquid.primaryColor)},`)
      if (liquid.secondaryColor?.trim()) {
        lines.push(`      secondaryColor: ${q(liquid.secondaryColor.trim())},`)
      }
      lines.push(
        `      opacity: ${Math.min(1, Math.max(0, Number(liquid.opacity) || 0.85))},`,
      )
      lines.push(`      texture: ${q(liquid.texture)},`)
      lines.push('    },')
    }
    if (t.recipe) {
      lines.push(
        `    recipe: { ingredientA: ${q(t.recipe.ingredientA)}, ingredientB: ${q(t.recipe.ingredientB)} },`,
      )
    }
    if (t.recipes && t.recipes.length > 1) {
      lines.push('    recipes: [')
      for (const r of t.recipes) {
        lines.push(
          `      { ingredientA: ${q(r.ingredientA)}, ingredientB: ${q(r.ingredientB)} },`,
        )
      }
      lines.push('    ],')
    }
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

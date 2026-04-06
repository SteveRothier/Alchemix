import type { Vial, VialRarity, VialType } from '../types'
import { pairKey } from './recipeMap'

export type NewVialDraft = Omit<Vial, 'id' | 'discoveredAt'>

const RARITY_ORDER: VialRarity[] = ['common', 'rare', 'epic', 'legendary']

function maxRarity(a: VialRarity, b: VialRarity): VialRarity {
  return RARITY_ORDER[
    Math.max(RARITY_ORDER.indexOf(a), RARITY_ORDER.indexOf(b))
  ] as VialRarity
}

function bumpRarity(r: VialRarity): VialRarity {
  const i = RARITY_ORDER.indexOf(r)
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, i + 1)] as VialRarity
}

function blendNamePart(a: string, b: string): string {
  const wa = a.trim().split(/\s+/)[0] ?? a
  const parts = b.trim().split(/\s+/)
  const wb = parts[parts.length - 1] ?? b
  return `${wa} ${wb}`.trim()
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  if (full.length !== 6) return null
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mixHex(a: string, b: string): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return a
  const r = Math.round((pa.r + pb.r) / 2)
  const g = Math.round((pa.g + pb.g) / 2)
  const bl = Math.round((pa.b + pb.b) / 2)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

function resultType(va: Vial, vb: Vial): VialType {
  if (va.type === 'creature' || vb.type === 'creature') return 'spell'
  if (va.type === 'element' && vb.type === 'element') return 'element'
  if (va.type === 'spell' && vb.type === 'spell') return 'spell'
  return 'spell'
}

/** Id stable pour une paire inconnue du seed (ordre des ingrédients ignoré). */
export function dynamicVialIdForPair(vialIdA: string, vialIdB: string): string {
  return `dyn-${pairKey(vialIdA, vialIdB).replaceAll('|', '-')}`
}

export function buildDynamicVialDraft(ingredientA: Vial, ingredientB: Vial): NewVialDraft {
  const type = resultType(ingredientA, ingredientB)
  const baseR = bumpRarity(maxRarity(ingredientA.rarity, ingredientB.rarity))
  const primary = mixHex(
    ingredientA.liquid.primaryColor,
    ingredientB.liquid.primaryColor,
  )

  return {
    type,
    name: blendNamePart(ingredientA.name, ingredientB.name),
    description: `Fusion of ${ingredientA.name} and ${ingredientB.name}.`,
    liquid: {
      primaryColor: primary,
      secondaryColor: ingredientA.liquid.secondaryColor
        ? mixHex(ingredientA.liquid.secondaryColor, ingredientB.liquid.primaryColor)
        : undefined,
      opacity: Math.min(
        0.98,
        (ingredientA.liquid.opacity + ingredientB.liquid.opacity) / 2,
      ),
      texture: ingredientA.liquid.texture,
    },
    icon: `${ingredientA.icon}_${ingredientB.icon}`,
    rarity: baseR,
    recipe: {
      ingredientA: ingredientA.id,
      ingredientB: ingredientB.id,
    },
    effect:
      type === 'spell'
        ? {
            animation: 'pulse',
            color: primary,
          }
        : undefined,
  }
}

export interface DynamicVialGenerator {
  generateElement(ingredientA: Vial, ingredientB: Vial): NewVialDraft
  generateSpell(ingredientA: Vial, ingredientB: Vial): NewVialDraft
}

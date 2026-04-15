import type { Vial, VialIcon, VialRarity } from '../types'
import { dynamicElementCraftPairKey } from './dynamicElementCraftIds'

export type ElementAffinity =
  | 'fire'
  | 'water'
  | 'earth'
  | 'air'
  | 'shadow'
  | 'light'
  | 'nature'
  | 'arcane'

export type IngredientKind =
  | 'primordial'
  | 'crafted'
  | 'spell'
  | 'creature'
  | 'unknown'

/** Ordre fixe pour ids canoniques d’amalgames (indices i ≤ j dans cette liste). */
export const ELEMENT_AFFINITY_ORDER: ElementAffinity[] = [
  'air',
  'arcane',
  'earth',
  'fire',
  'light',
  'nature',
  'shadow',
  'water',
]

export interface IngredientProfile {
  affinity: ElementAffinity
  kind: IngredientKind
  /** Dérivé de la rareté (0 = common … 3 = legendary) */
  intensity: number
}

const RARITY_TO_INTENSITY: Record<VialRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
}

function kindFromVial(vial: Vial): IngredientKind {
  const { id, type } = vial
  if (id.startsWith('creature-') || type === 'creature') return 'creature'
  if (id.startsWith('dyn-sp-')) return 'spell'
  if (id.startsWith('sp-')) return 'spell'
  if (id.startsWith('el-')) return 'primordial'
  if (id.startsWith('dyn-el-')) return 'crafted'
  if (id.startsWith('craft-') || id.startsWith('dyn-')) return 'crafted'
  if (type === 'element') return 'crafted'
  return 'unknown'
}

function affinityFromPrimordialId(id: string): ElementAffinity | null {
  if (!id.startsWith('el-')) return null
  const tail = id.slice(3)
  const map: Record<string, ElementAffinity> = {
    fire: 'fire',
    water: 'water',
    earth: 'earth',
    air: 'air',
    shadow: 'shadow',
    light: 'light',
    nature: 'nature',
  }
  return map[tail] ?? null
}

function affinityFromCreatureId(id: string): ElementAffinity {
  const low = id.toLowerCase()
  if (low.includes('infernal')) return 'fire'
  if (low.includes('frost')) return 'water'
  if (low.includes('shadow')) return 'shadow'
  if (low.includes('celestial')) return 'light'
  if (low.includes('storm')) return 'air'
  if (low.includes('toxic')) return 'nature'
  if (low.includes('beast')) return 'nature'
  return 'arcane'
}

/** Mots-clés dans l’id (ordre : plus spécifiques / ambiguës en premier). */
const AFFINITY_SCAN: { affinity: ElementAffinity; keys: string[] }[] = [
  {
    affinity: 'shadow',
    keys: [
      'shadow',
      'void',
      'twilight',
      'umbral',
      'abyss',
      'dark-pulse',
      'plague',
      'pestilence',
      'skull',
    ],
  },
  {
    affinity: 'light',
    keys: [
      'light',
      'gold',
      'sun',
      'holy',
      'celestial',
      'radiant',
      'golden',
      'phoenix',
      'star',
      'sunwind',
    ],
  },
  {
    affinity: 'nature',
    keys: [
      'nature',
      'bloom',
      'swamp',
      'venom',
      'pollen',
      'soil',
      'wildspark',
      'blight',
      'leaf',
      'dirt',
    ],
  },
  {
    affinity: 'fire',
    keys: [
      'infernal',
      'lava',
      'inferno',
      'magma',
      'scalding',
      'hell',
      'ember',
      'scorch',
      'el-fire',
      'fire',
      'steam',
      'ash',
    ],
  },
  {
    affinity: 'water',
    keys: [
      'tidal',
      'brine',
      'icy',
      'crystal',
      'mist',
      'spindrift',
      'mud',
      'water',
      'geyser',
    ],
  },
  {
    affinity: 'earth',
    keys: ['granite', 'sand', 'loess', 'stone', 'el-earth', 'earth'],
  },
  {
    affinity: 'air',
    keys: [
      'cyclone',
      'tornado',
      'tempest',
      'lightning',
      'wind',
      'gale',
      'dust',
      'el-air',
      'air',
    ],
  },
]

function affinityFromGenericId(id: string): ElementAffinity {
  const low = id.toLowerCase()
  for (const { affinity, keys } of AFFINITY_SCAN) {
    if (keys.some((k) => low.includes(k))) return affinity
  }
  return 'arcane'
}

export function getIngredientProfile(vial: Vial): IngredientProfile {
  const kind = kindFromVial(vial)
  const intensity = RARITY_TO_INTENSITY[vial.rarity] ?? 0
  const { id } = vial

  const pairKeyStr =
    dynamicElementCraftPairKey(id) ??
    (() => {
      const elCanon = /^dyn-el-(\d+)-(\d+)$/.exec(id)
      if (!elCanon) return null
      const lo = Math.min(Number(elCanon[1]), Number(elCanon[2]))
      const hi = Math.max(Number(elCanon[1]), Number(elCanon[2]))
      return `${lo}-${hi}`
    })()
  if (pairKeyStr) {
    const [loS, hiS] = pairKeyStr.split('-')
    const lo = Number(loS)
    const hi = Number(hiS)
    const affLo = ELEMENT_AFFINITY_ORDER[lo]
    const affHi = ELEMENT_AFFINITY_ORDER[hi]
    if (affLo && affHi) {
      const { dominant } = combineIngredientProfiles(
        { affinity: affLo, kind: 'crafted', intensity: 0 },
        { affinity: affHi, kind: 'crafted', intensity: 0 },
      )
      return { affinity: dominant, kind: 'crafted', intensity }
    }
    return {
      affinity: affLo ?? affHi ?? 'arcane',
      kind: 'crafted',
      intensity,
    }
  }

  const spCanon =
    /^dyn-sp-(air|arcane|earth|fire|light|nature|shadow|water)-(mono|air|arcane|earth|fire|light|nature|shadow|water)$/.exec(
      id,
    )
  if (spCanon) {
    return {
      affinity: spCanon[1] as ElementAffinity,
      kind: 'spell',
      intensity,
    }
  }

  if (kind === 'creature') {
    return {
      affinity: affinityFromCreatureId(vial.id),
      kind,
      intensity,
    }
  }

  const prim = affinityFromPrimordialId(vial.id)
  if (prim) {
    return { affinity: prim, kind, intensity }
  }

  return {
    affinity: affinityFromGenericId(vial.id),
    kind,
    intensity,
  }
}

export function iconForAffinity(affinity: ElementAffinity): VialIcon {
  const m: Record<ElementAffinity, VialIcon> = {
    fire: 'flame',
    water: 'rune',
    earth: 'leaf',
    air: 'rune',
    shadow: 'skull',
    light: 'star',
    nature: 'leaf',
    arcane: 'rune',
  }
  return m[affinity]
}

export function combineIngredientProfiles(
  a: IngredientProfile,
  b: IngredientProfile,
): { dominant: ElementAffinity; secondary: ElementAffinity | null } {
  const score: Partial<Record<ElementAffinity, number>> = {}
  const add = (p: IngredientProfile) => {
    const w = 1 + p.intensity * 0.15
    score[p.affinity] = (score[p.affinity] ?? 0) + w
  }
  add(a)
  add(b)
  const entries = Object.entries(score) as [ElementAffinity, number][]
  entries.sort((x, y) => y[1] - x[1])
  const dominant = entries[0]?.[0] ?? 'arcane'
  const secondary = entries[1]?.[0] ?? null
  return { dominant, secondary }
}

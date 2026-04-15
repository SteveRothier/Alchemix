import type { Vial } from '../types'

/** Définitions sans date de découverte — horodatage appliqué à l’init / reset. */
export const STARTER_VIAL_DEFINITIONS: Omit<Vial, 'discoveredAt'>[] = [
  {
    id: 'el-fire',
    type: 'element',
    name: 'Fire',
    description: 'Flamme primordiale.',
    liquid: {
      primaryColor: '#e85d04',
      secondaryColor: '#ffba08',
      opacity: 0.92,
      texture: 'spark',
    },
    icon: 'flame',
    rarity: 'common',
  },
  {
    id: 'el-water',
    type: 'element',
    name: 'Water',
    description: 'Source de toute humidité.',
    liquid: {
      primaryColor: '#219ebc',
      secondaryColor: '#8ecae6',
      opacity: 0.88,
      texture: 'wave',
    },
    icon: 'rune',
    rarity: 'common',
  },
  {
    id: 'el-earth',
    type: 'element',
    name: 'Earth',
    description: 'Matière stable et fertile.',
    liquid: {
      primaryColor: '#6f4e37',
      secondaryColor: '#a67c52',
      opacity: 0.9,
      texture: 'liquid',
    },
    icon: 'leaf',
    rarity: 'common',
  },
  {
    id: 'el-air',
    type: 'element',
    name: 'Air',
    description: 'Souffle invisible et mouvant.',
    liquid: {
      primaryColor: '#cfe8ff',
      secondaryColor: '#e8f4ff',
      opacity: 0.55,
      texture: 'smoke',
    },
    icon: 'rune',
    rarity: 'common',
  },
  {
    id: 'el-grass',
    type: 'element',
    name: 'Grass',
    description: 'Vie sauvage et croissance.',
    liquid: {
      primaryColor: '#2d6a4f',
      secondaryColor: '#52b788',
      opacity: 0.9,
      texture: 'bubbles',
    },
    icon: 'leaf',
    rarity: 'common',
  },
]

export function stampStarterVials(isoTime: string): Record<string, Vial> {
  const map: Record<string, Vial> = {}
  for (const def of STARTER_VIAL_DEFINITIONS) {
    map[def.id] = { ...def, discoveredAt: isoTime }
  }
  return map
}

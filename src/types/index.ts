export type VialType = 'element' | 'creature'

export type LiquidTexture =
  | 'bubbles'
  | 'crystal'
  | 'drip'
  | 'ember'
  | 'flakes'
  | 'glow'
  | 'liquid'
  | 'mist'
  | 'ooze'
  | 'sheen'
  | 'smoke'
  | 'spark'
  | 'static'
  | 'swirl'
  | 'wave'

export type VialRarity = 'common' | 'rare' | 'epic' | 'legendary'

/** Icônes pixel connues ; d’autres clés peuvent être ajoutées au fil des assets. */
export type VialIcon =
  | 'skull'
  | 'flame'
  | 'rune'
  | 'star'
  | 'leaf'
  | string

export interface Vial {
  id: string
  type: VialType
  name: string
  description: string
  liquid: {
    primaryColor: string
    secondaryColor?: string
    opacity: number
    texture: LiquidTexture
  }
  icon: VialIcon
  recipe?: {
    ingredientA: string
    ingredientB: string
  }
  effect?: {
    animation: string
    color: string
    sound?: string
  }
  /** ISO 8601 — sérialisable (persist / export JSON) */
  discoveredAt: string
  rarity: VialRarity
}

export type NewVialDraft = Omit<Vial, 'id' | 'discoveredAt'>

export interface Recipe {
  id: string
  vialA: string
  vialB: string
  result: string
}

export type AchievementCondition =
  | 'discover_element'
  | 'create_combo'
  | 'unlock_tier'

export interface Achievement {
  id: string
  title: string
  description: string
  condition: AchievementCondition
  progress: number
  target: number
  reward: { xp: number; badge: string }
  unlockedAt?: string
}

/**
 * Trophées par thème — ordre des entrées = priorité en cas d’égalité de score.
 *
 * | id          | rôle |
 * | ----------- | ---- |
 * | foundations | éléments de base |
 * | nature      | monde physique |
 * | weather     | phénomènes |
 * | stone       | matière solide |
 * | tech        | artificiel |
 * | space       | cosmique |
 * | mythic      | magique |
 * | forbidden   | corruption |
 * | emotion     | interne |
 * | concept     | règles / systèmes abstraits |
 */
export type TrophyCategoryId =
  | 'foundations'
  | 'nature'
  | 'weather'
  | 'stone'
  | 'tech'
  | 'space'
  | 'mythic'
  | 'forbidden'
  | 'emotion'
  | 'concept'

export type TrophyCategoryDef = {
  id: TrophyCategoryId
  label: string
  keywords: string[]
}

export const TROPHY_CATEGORY_DEFS: TrophyCategoryDef[] = [
  {
    id: 'foundations',
    label: 'Foundations',
    keywords: ['air', 'water', 'fire', 'light', 'ember', 'mist', 'steam'],
  },
  {
    id: 'nature',
    label: 'Nature',
    keywords: [
      'nature',
      'grass',
      'plant',
      'forest',
      'wood',
      'tree',
      'life',
      'predator',
      'nectar',
      'biomass',
      'earth',
      'sand',
      'soil',
      'desert',
      'grove',
      'swamp',
      'marsh',
      'bog',
      'mud',
      'quicksand',
      'bloom',
      'ocean',
      'glacier',
      'craft-lava',
      'volcano',
      'eruption',
      'lava',
    ],
  },
  {
    id: 'weather',
    label: 'Weather',
    keywords: [
      'cloud',
      'rain',
      'storm',
      'tempest',
      'cyclone',
      'tornado',
      'typhoon',
      'monsoon',
      'hurricane',
      'thunder',
      'lightning',
      'wind',
      'breeze',
      'gust',
      'gale',
      'squall',
      'vortex',
      'whirl',
      'snow',
      'ice',
      'frost',
      'blizzard',
      'hail',
      'sleet',
      'drizzle',
      'drought',
      'flood',
      'heatwave',
      'sandstorm',
      'duststorm',
      'wildfire',
      'fog',
      'vapor',
      'pressure',
    ],
  },
  {
    id: 'stone',
    label: 'Stone',
    keywords: [
      'craft-stone',
      'craft-obsidian',
      'craft-gold',
      'craft-crystal',
      'diamond',
      'ruby',
      'monolith',
      'amethyst',
      'emerald',
      'sapphire',
      'metal',
    ],
  },
  {
    id: 'tech',
    label: 'Tech',
    keywords: [
      'cyber',
      'tesla',
      'laser',
      'glitch',
      'error',
      'flux',
      'energy',
      'power',
      'electric',
      'telekinesis',
      'teleport',
    ],
  },
  {
    id: 'space',
    label: 'Space',
    keywords: [
      'craft-void',
      'space',
      'cosmos',
      'star',
      'sun',
      'moon',
      'galaxy',
      'constellation',
      'astral',
      'darkmatter',
      'blackhole',
      'portal',
      'dimension',
      'sky',
      'comet',
      'meteor',
    ],
  },
  {
    id: 'mythic',
    label: 'Mythic',
    keywords: [
      'arcane',
      'divine',
      'sacred',
      'oracle',
      'mana',
      'halo',
      'genesis',
      'oath',
      'holy',
      'legend',
      'mirage',
      'illusion',
      'hex',
      'omen',
    ],
  },
  {
    id: 'forbidden',
    label: 'Forbidden',
    keywords: [
      'apocalypse',
      'cataclysm',
      'chaos',
      'death',
      'doom',
      'wither',
      'necro',
      'parasite',
      'virus',
      'acid',
      'hollow',
      'null',
      'dark',
      'blight',
      'curse',
      'nightmare',
      'nether',
    ],
  },
  {
    id: 'emotion',
    label: 'Emotion',
    keywords: [
      'love',
      'fear',
      'joy',
      'calm',
      'hope',
      'trust',
      'desire',
      'faith',
      'hate',
      'envy',
      'rage',
      'anger',
      'terror',
      'despair',
      'courage',
      'guilt',
      'doubt',
      'paranoia',
      'panic',
      'devotion',
      'dream',
      'luck',
      'mind',
      'psych',
      'telepathy',
      'soul',
      'spirit',
    ],
  },
  {
    id: 'concept',
    label: 'Concept',
    keywords: [
      'time',
      'paradox',
      'riddle',
      'quantum',
      'loop',
      'gravity',
      'memory',
      'essence',
      'harmony',
      'logic',
      'chronos',
      'rewind',
      'hieroglyph',
      'relic',
      'enigma',
    ],
  },
]

/** Catégorie trophée pour un élément (id + nom), pour l’UI des trophées par thème. */
export function resolveTrophyCategoryForElement(
  id: string,
  name: string,
): TrophyCategoryId {
  const haystack = `${id} ${name}`.trim().toLowerCase()
  if (!haystack) return 'foundations'
  let best: TrophyCategoryId = 'foundations'
  let bestScore = 0
  for (const def of TROPHY_CATEGORY_DEFS) {
    let score = 0
    for (const key of def.keywords) {
      if (haystack.includes(key)) score += key.length >= 6 ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      best = def.id
    }
  }
  return best
}

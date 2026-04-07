/**
 * Noms d’éléments dynamiques : un seul mot par couple d’indices d’affinité
 * (alignés sur ELEMENT_AFFINITY_ORDER : air, arcane, earth, fire, light, nature, shadow, water).
 */
export const SIMPLE_ELEMENT_BY_INDEX_PAIR: Record<string, string> = {
  '0-0': 'Zephyr',
  '0-1': 'Space',
  '0-2': 'Dune',
  '0-3': 'Spark',
  '0-4': 'Dawn',
  '0-5': 'Pollen',
  '0-6': 'Mistral',
  '0-7': 'Foam',
  '1-1': 'Rune',
  '1-2': 'Fossil',
  '1-3': 'Coal',
  '1-4': 'Prism',
  '1-5': 'Spore',
  '1-6': 'Omen',
  '1-7': 'Abyss',
  '2-2': 'Loam',
  '2-3': 'Magma',
  '2-4': 'Crystal',
  '2-5': 'Humus',
  '2-6': 'Obsidian',
  '2-7': 'Silt',
  '3-3': 'Cinder',
  '3-4': 'Flare',
  '3-5': 'Ember',
  '3-6': 'Smolder',
  '3-7': 'Vapor',
  '4-4': 'Glint',
  '4-5': 'Glow',
  '4-6': 'Twilight',
  '4-7': 'Mirror',
  '5-5': 'Thicket',
  '5-6': 'Fester',
  '5-7': 'Lagoon',
  '6-6': 'Umbra',
  '6-7': 'Murk',
  '7-7': 'Tide',
}

export function simpleElementNameFromCanonicalId(canonicalId: string): string {
  const m = /^dyn-el-(\d+)-(\d+)$/.exec(canonicalId)
  if (!m) return 'Dross'
  const lo = Math.min(Number(m[1]), Number(m[2]))
  const hi = Math.max(Number(m[1]), Number(m[2]))
  return SIMPLE_ELEMENT_BY_INDEX_PAIR[`${lo}-${hi}`] ?? 'Dross'
}

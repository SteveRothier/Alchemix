import {
  amalgamCraftPairKey,
  isAmalgamCraftId,
} from './amalgamCraftIds'
import { SIMPLE_ELEMENT_BY_INDEX_PAIR } from './simpleElementData'

export { SIMPLE_ELEMENT_BY_INDEX_PAIR } from './simpleElementData'

export function simpleElementNameFromCanonicalId(canonicalId: string): string {
  if (isAmalgamCraftId(canonicalId)) {
    const k = amalgamCraftPairKey(canonicalId)
    if (k) return SIMPLE_ELEMENT_BY_INDEX_PAIR[k] ?? 'Dross'
  }
  const m = /^dyn-el-(\d+)-(\d+)$/.exec(canonicalId)
  if (!m) return 'Dross'
  const lo = Math.min(Number(m[1]), Number(m[2]))
  const hi = Math.max(Number(m[1]), Number(m[2]))
  return SIMPLE_ELEMENT_BY_INDEX_PAIR[`${lo}-${hi}`] ?? 'Dross'
}

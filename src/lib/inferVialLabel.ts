import { isAmalgamCraftId } from './amalgamCraftIds'
import { simpleElementNameFromCanonicalId } from './simpleElementNames'

/** Libellé lisible dérivé d’une référence technique (el-fire → Fire, craft-steam → Steam). */
export function inferLabelFromRef(ref: string): string {
  const s = ref.trim()
  if (!s) return ''
  if (isAmalgamCraftId(s) || /^dyn-el-\d+-\d+$/.test(s)) {
    return simpleElementNameFromCanonicalId(s)
  }
  const core = s.replace(/^(el|craft|sp|creature|leg)-/i, '')
  const parts = (core || s).split(/[-_/]+/).filter(Boolean)
  if (parts.length === 0) return s
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

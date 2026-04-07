import type { LiquidTexture } from '../types'

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
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

export function mixHex(a: string, b: string): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return a
  const r = Math.round((pa.r + pb.r) / 2)
  const g = Math.round((pa.g + pb.g) / 2)
  const bl = Math.round((pa.b + pb.b) / 2)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

/** Mélange secondaire : moyenne des deux secondaires si présents, sinon secondaire A avec B primaire. */
export function blendSecondaryColors(
  primaryA: string,
  primaryB: string,
  secondaryA: string | undefined,
  secondaryB: string | undefined,
): string | undefined {
  if (secondaryA && secondaryB) return mixHex(secondaryA, secondaryB)
  if (secondaryA) return mixHex(secondaryA, primaryB)
  if (secondaryB) return mixHex(primaryA, secondaryB)
  return undefined
}

const TEXTURE_PRIORITY: LiquidTexture[] = [
  'spark',
  'wave',
  'liquid',
  'smoke',
  'bubbles',
]

export function mergeTextures(a: LiquidTexture, b: LiquidTexture): LiquidTexture {
  if (a === b) return a
  for (const t of TEXTURE_PRIORITY) {
    if (a === t || b === t) return t
  }
  return 'liquid'
}

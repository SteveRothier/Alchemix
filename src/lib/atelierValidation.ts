import { pairKey } from './recipeMap'

export const AMBIGUOUS_NAME_ERROR =
  'Several vials share the same name: use the technical reference or a unique name.'

export const HALF_PAIR_ERROR =
  'Either fill both ingredients or leave both empty (not just one).'

type PairLike = { clientId?: number; a: string; b: string; resultId: string }
type SoloLike = { clientId?: number; id: string }

export function hasHalfFilledPair(a: string, b: string): boolean {
  return (!!a && !b) || (!a && !!b)
}

export function hasPairConflict(
  pairs: PairLike[],
  a: string,
  b: string,
  resultId: string,
  excludeClientId?: number,
): boolean {
  if (a === '' && b === '') {
    return pairs.some(
      (p) =>
        p.clientId !== excludeClientId &&
        !p.a.trim() &&
        !p.b.trim() &&
        p.resultId.trim() === resultId,
    )
  }
  const key = pairKey(a, b)
  return pairs.some(
    (p) =>
      p.clientId !== excludeClientId && pairKey(p.a.trim(), p.b.trim()) === key,
  )
}

export function hasSoloConflict(
  rows: SoloLike[],
  id: string,
  excludeClientId?: number,
): boolean {
  return rows.some((s) => s.clientId !== excludeClientId && s.id === id)
}

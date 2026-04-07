/** Choix déterministe à partir d’une graine (même résultat pour un même id canonique). */
export function stablePick(seed: string, options: readonly string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return options[h % options.length]!
}

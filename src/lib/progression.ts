/** Tier 1–10 à partir du nombre de fioles découvertes (ajustable plus tard). */
export function tierFromDiscoveryCount(count: number): number {
  if (count <= 0) return 1
  return Math.min(10, 1 + Math.floor((count - 1) / 10))
}

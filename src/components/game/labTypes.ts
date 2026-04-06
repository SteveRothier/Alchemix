export type LabPlacedVial = {
  instanceId: string
  vialId: string
  /** Position horizontale dans le labo (0–100 %, centre de la fiole) */
  xPct: number
  /** Position verticale dans le labo (0–100 %, centre de la fiole) */
  yPct: number
}

export type LabDragData =
  | { kind: 'inventory'; vialId: string }
  | { kind: 'lab'; instanceId: string; vialId: string }

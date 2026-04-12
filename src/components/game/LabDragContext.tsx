import { createContext, useContext, type MutableRefObject } from 'react'
import type { Draggable as DraggableInstance } from 'gsap/Draggable'

export type GrabOffset = { dx: number; dy: number }

/** Fin de drag inventaire (pointeur natif, pas Draggable — mouvement fluide sans grille). */
export type InventoryDragEndInfo = {
  target: HTMLElement
  pointerX: number
  pointerY: number
}

export type LabDragContextValue = {
  grabOffsetRef: MutableRefObject<GrabOffset | null>
  completeInventoryDrag: (vialId: string, info: InventoryDragEndInfo) => void
  /** `true` = ne pas remettre le dragLayer à 0 (ex. animation à la position du dépôt inventaire). */
  completeLabDrag: (
    instanceId: string,
    vialId: string,
    drag: DraggableInstance,
  ) => boolean
}

export const LabDragContext = createContext<LabDragContextValue | null>(null)

export function useLabDrag(): LabDragContextValue | null {
  return useContext(LabDragContext)
}

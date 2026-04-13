import {
  createContext,
  useContext,
  type MutableRefObject,
  type RefObject,
} from 'react'
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
  /** Canvas laboratoire (fioles posées) — pour hit-test sans querySelector fragile. */
  labCanvasRef: RefObject<HTMLDivElement | null>
  /** Retourne une promesse si une fusion animée retarde le retrait du clone inventaire. */
  completeInventoryDrag: (
    vialId: string,
    info: InventoryDragEndInfo,
  ) => void | Promise<void>
  /** `true` = ne pas remettre le dragLayer à 0 (ex. animation à la position du dépôt inventaire). */
  completeLabDrag: (
    instanceId: string,
    vialId: string,
    drag: DraggableInstance,
  ) => boolean
  /** Fantôme inventaire actif : styles globaux (curseur, pas de dégradé hover). */
  setInventoryGhostDragging: (active: boolean) => void
  /** Clic sur une fiole inventaire (sans drag) : ajoute une instance près du centre du labo. */
  placeInventoryVialNearLabCenter: (vialId: string) => void
}

export const LabDragContext = createContext<LabDragContextValue | null>(null)

export function useLabDrag(): LabDragContextValue | null {
  return useContext(LabDragContext)
}

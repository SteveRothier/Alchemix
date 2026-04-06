import { useDroppable } from '@dnd-kit/core'
import type { RefObject } from 'react'
import type { Vial } from '../../types'
import { CanvasVialItem } from './CanvasVialItem'
import type { LabPlacedVial } from './labTypes'
import styles from './LabCanvas.module.css'

const LAB_CANVAS_ID = 'lab-canvas'

type LabCanvasProps = {
  placed: LabPlacedVial[]
  vialsById: Record<string, Vial>
  canvasRef: RefObject<HTMLDivElement | null>
  onRemovePlaced: (instanceId: string) => void
}

export function LabCanvas({
  placed,
  vialsById,
  canvasRef,
  onRemovePlaced,
}: LabCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: LAB_CANVAS_ID,
  })

  const setCombinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    canvasRef.current = node
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Laboratoire</h2>
      <div
        ref={setCombinedRef}
        className={styles.canvas}
        data-over={isOver || undefined}
        aria-label="Zone de placement des fioles"
      >
        {placed.map((p, i) => {
          const v = vialsById[p.vialId]
          if (!v) return null
          return (
            <CanvasVialItem
              key={p.instanceId}
              placed={p}
              vial={v}
              zIndex={10 + i}
              onRemove={onRemovePlaced}
            />
          )
        })}
        {placed.length === 0 && (
          <p className={styles.hint}>
            Glisse des fioles depuis l’inventaire. Pose-les où tu veux, puis
            glisse-en une sur une autre pour fusionner.
          </p>
        )}
      </div>
    </div>
  )
}

export { LAB_CANVAS_ID }

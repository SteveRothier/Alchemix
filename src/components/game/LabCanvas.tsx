import { useDroppable } from '@dnd-kit/core'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
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
  onDuplicatePlaced: (source: LabPlacedVial) => void
}

export function LabCanvas({
  placed,
  vialsById,
  canvasRef,
  onRemovePlaced,
  onDuplicatePlaced,
}: LabCanvasProps) {
  const { setNodeRef } = useDroppable({
    id: LAB_CANVAS_ID,
  })

  const setCombinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    canvasRef.current = node
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Laboratoire</h2>
        <Link
          className={styles.recipesBtn}
          to="/recipes"
          title="Gérer les combinaisons de fioles"
        >
          Recettes
        </Link>
      </div>
      <div
        ref={setCombinedRef}
        className={styles.canvas}
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
              onDuplicate={onDuplicatePlaced}
            />
          )
        })}
        {placed.length === 0 && (
          <p className={styles.hint}>
            Glisse des fioles depuis l’inventaire. Pose-les où tu veux, puis
            glisse-en une sur une autre pour fusionner. Double-clic sur une
            fiole du labo pour la dupliquer.
          </p>
        )}
      </div>
    </div>
  )
}

export { LAB_CANVAS_ID }

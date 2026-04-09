import { useDroppable } from '@dnd-kit/core'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { Vial } from '../../types'
import { CanvasVialItem } from './CanvasVialItem'
import type { LabPlacedVial } from './labTypes'

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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.45rem]">
      <div className="flex min-w-0 shrink-0 items-center justify-between gap-2">
        <h2 className="lab-canvasTitle">Laboratoire</h2>
        <Link
          className="lab-recipesBtn"
          to="/recipes"
          title="Gérer les combinaisons de fioles"
        >
          Recettes
        </Link>
      </div>
      <div
        ref={setCombinedRef}
        className="lab-canvas"
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
          <p className="lab-canvasHint">
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

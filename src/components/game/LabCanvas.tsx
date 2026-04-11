import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { Vial } from '../../types'
import { CanvasVialItem } from './CanvasVialItem'
import type { LabPlacedVial } from './labTypes'

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
  return (
    <div className="relative h-full min-h-0 min-w-0">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex min-w-0 items-start justify-between gap-2 px-[0.85rem] pt-[0.65rem]">
        <h2 className="lab-canvasTitle pointer-events-auto">Laboratoire</h2>
        <Link
          className="lab-recipesBtn pointer-events-auto"
          to="/recipes"
          title="Gérer les combinaisons de fioles"
        >
          Recettes
        </Link>
      </div>
      <div
        ref={canvasRef}
        className="lab-canvas lab-canvas--fill"
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
      </div>
    </div>
  )
}

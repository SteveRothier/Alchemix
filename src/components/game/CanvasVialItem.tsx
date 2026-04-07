import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Vial } from '../../types'
import { VialChip } from '../vial/VialChip'
import type { LabPlacedVial } from './labTypes'
import styles from './CanvasVialItem.module.css'

type CanvasVialItemProps = {
  placed: LabPlacedVial
  vial: Vial
  zIndex: number
  onRemove: (instanceId: string) => void
}

export function CanvasVialItem({
  placed,
  vial,
  zIndex,
  onRemove,
}: CanvasVialItemProps) {
  const dragId = `lab-drag-${placed.instanceId}`
  const dropId = `lab-target-${placed.instanceId}`

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    data: {
      kind: 'lab' as const,
      instanceId: placed.instanceId,
      vialId: placed.vialId,
    },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId,
    data: { instanceId: placed.instanceId, vialId: placed.vialId },
  })

  const dragT = CSS.Translate.toString(transform)
  const anchorStyle = {
    left: `${placed.xPct}%`,
    top: `${placed.yPct}%`,
    zIndex: isOver ? 800 + zIndex : isDragging ? -1 : zIndex,
    transform: dragT
      ? `translate(-50%, -50%) ${dragT}`
      : 'translate(-50%, -50%)',
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? ('none' as const) : ('auto' as const),
  } as const

  return (
    <div className={styles.anchor} style={anchorStyle}>
      <div
        ref={setDropRef}
        className={styles.dropHit}
        data-over-target={isOver || undefined}
      >
        <div
          ref={setDragRef}
          className={styles.dragSurface}
          title="Clic droit pour retirer du labo"
          aria-label={`${vial.name} — glisser pour déplacer, clic droit pour retirer du labo`}
          {...listeners}
          {...attributes}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove(placed.instanceId)
          }}
        >
          <VialChip vial={vial} lab />
        </div>
      </div>
    </div>
  )
}
